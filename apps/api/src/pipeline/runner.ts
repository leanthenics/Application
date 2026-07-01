import type { JobResult, Product } from '@clickretina/contract';
import type { JobData } from '../jobs/shared.js';
import type { PipelineContext } from './context.js';
import { runStep } from './step.js';
import { enhancePromptStep } from './steps/enhancePrompt.js';
import { editImageStep } from './steps/editImage.js';
import { extractKeytermsStep } from './steps/extractKeyterms.js';
import { buildAmazonUrl } from './amazon.js';

/**
 * The 3-model pipeline (architecture §4). Built one model at a time; the public
 * `JobResult` contract stays stable as stubs are replaced.
 *
 *   1. enhancePrompt   (Gemini Flash-Lite vision)   — REAL (B2.1)
 *   2. editImage       (Replicate Qwen | Kontext)   — REAL (B2.2)
 *   3. extractKeyterms (Gemini Flash-Lite vision)   — REAL (B2.3)
 *   4. Amazon URLs     (affiliate link builder)     — REAL (B2.4)
 */

export async function runPipeline(data: JobData, ctx: PipelineContext): Promise<JobResult> {
  // Step 1 — REAL: enhance the user's prompt, using the input image so Model 1
  // suggests space-appropriate products and preserves/integrates into the scene.
  const enhancedPrompt = await runStep(
    enhancePromptStep,
    { image: data.image, mimeType: data.mimeType, prompt: data.prompt },
    ctx,
  );
  console.log(`[pipeline] ${ctx.jobId} enhancedPrompt="${enhancedPrompt}"`);

  // Step 2 — REAL: edit the input image with Qwen using the enhanced prompt.
  const edited = await runStep(
    editImageStep,
    { image: data.image, mimeType: data.mimeType, prompt: enhancedPrompt },
    ctx,
  );

  // Step 3 — REAL: read shoppable product key-terms from the edited image.
  const keyterms = await runStep(
    extractKeytermsStep,
    { image: edited.image, mimeType: edited.mimeType },
    ctx,
  );

  // Step 4 — REAL: build the affiliate search URL for each key-term.
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
