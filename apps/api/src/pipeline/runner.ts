import type { JobResult, Product } from '@clickretina/contract';
import type { JobData } from '../jobs/shared.js';
import { getStyle } from '../styles/catalog.js';
import type { PipelineContext } from './context.js';
import { runStep } from './step.js';
import { analyzeSceneStep } from './steps/analyzeScene.js';
import { enhancePromptStep } from './steps/enhancePrompt.js';
import { editImageStep } from './steps/editImage.js';
import { extractKeytermsStep } from './steps/extractKeyterms.js';
import { buildAmazonUrl } from './amazon.js';

/**
 * The pipeline (architecture §4). Each front-end model does one job; the public
 * `JobResult` contract stays stable.
 *
 *   1. analyzeScene    (Gemini Flash vision)     — original image → scene + editable zones (JSON)
 *   2. enhancePrompt   (Gemini Flash text)       — style + optional prompt + scene → instruction
 *   3. editImage       (Replicate nano-banana)   — image + scene + instruction → edited image
 *   4. extractKeyterms (Gemini Flash-Lite vision)— edited image → shoppable key-terms
 *   5. Amazon URLs     (affiliate link builder)  — key-term → search URL
 */

export async function runPipeline(data: JobData, ctx: PipelineContext): Promise<JobResult> {
  // Resolve the chosen garden style from the catalog (validated at POST time; be
  // tolerant if the manifest changed between enqueue and processing).
  const style = await getStyle(data.style);
  const styleLabel = style?.label ?? data.style;
  const styleGuidance = style?.guidance ?? `a ${data.style} garden`;

  // Step 1 — analyze the ORIGINAL image: space + positively-framed editable zones.
  const scene = await runStep(
    analyzeSceneStep,
    { image: data.image, mimeType: data.mimeType },
    ctx,
  );
  console.log(
    `[pipeline] ${ctx.jobId} style="${styleLabel}" scene="${scene.spaceType} (${scene.setting}), ${scene.editableZones.length} zone(s)"`,
  );

  // Step 2 — turn the chosen style (+ optional user prompt) into one render-friendly instruction.
  const enhancedPrompt = await runStep(
    enhancePromptStep,
    { styleLabel, styleGuidance, prompt: data.prompt, scene },
    ctx,
  );
  console.log(`[pipeline] ${ctx.jobId} enhancedPrompt="${enhancedPrompt}"`);

  // Step 3 — edit the input image: add into the zones, preserve everything else.
  const edited = await runStep(
    editImageStep,
    { image: data.image, mimeType: data.mimeType, prompt: enhancedPrompt, scene },
    ctx,
  );

  // Step 4 — read shoppable product key-terms from the edited image.
  const keyterms = await runStep(
    extractKeytermsStep,
    { image: edited.image, mimeType: edited.mimeType },
    ctx,
  );

  // Step 5 — build the affiliate search URL for each key-term.
  const products: Product[] = keyterms.map((keyterm) => ({
    keyterm,
    amazonUrl: buildAmazonUrl(keyterm),
  }));

  return {
    outputImage: edited.image,
    mimeType: edited.mimeType,
    products,
  };
}
