import type { JobResult, Product } from '@clickretina/contract';
import { config } from '../config.js';
import type { JobData } from '../jobs/shared.js';
import type { PipelineContext } from './context.js';
import { runStep } from './step.js';
import { enhancePromptStep } from './steps/enhancePrompt.js';
import { editImageStep } from './steps/editImage.js';

/**
 * The 3-model pipeline (architecture §4). Built one model at a time; the public
 * `JobResult` contract stays stable as stubs are replaced.
 *
 *   1. enhancePrompt   (Gemini Flash-Lite)        — REAL (B2.1)
 *   2. editImage       (Replicate Qwen Image 2.0) — REAL (B2.2)
 *   3. extractKeyterms (Gemini Flash-Lite vision) — TODO(B2.3): stubbed (fixed keyterms)
 *   4. Amazon URLs     (affiliate link builder)   — TODO(B2.4): stub URL shape (final shape)
 */

// ── TODO(B2.3) stub: placeholder keyterms until Model 3 (vision) extracts real ones. ──
const STUB_KEYTERMS = ['modern white sofa', 'wooden coffee table', 'arc floor lamp'];

// ── TODO(B2.4) stub: final affiliate URL shape (architecture §5 / decision 5). ──
function stubAmazonUrl(keyterm: string): string {
  return `https://www.amazon.${config.amazon.tld}/s?k=${encodeURIComponent(keyterm)}&tag=${encodeURIComponent(config.amazon.affiliateTag)}`;
}

function stubProducts(): Product[] {
  return STUB_KEYTERMS.map((keyterm) => ({ keyterm, amazonUrl: stubAmazonUrl(keyterm) }));
}

export async function runPipeline(data: JobData, ctx: PipelineContext): Promise<JobResult> {
  // Step 1 — REAL: enhance the user's prompt for the image-editing model.
  const enhancedPrompt = await runStep(enhancePromptStep, data.prompt, ctx);
  console.log(`[pipeline] ${ctx.jobId} enhancedPrompt="${enhancedPrompt}"`);

  // Step 2 — REAL: edit the input image with Qwen using the enhanced prompt.
  const edited = await runStep(
    editImageStep,
    { image: data.image, mimeType: data.mimeType, prompt: enhancedPrompt },
    ctx,
  );

  // Steps 3–4 — STUB until B2.3–B2.4 (keyterms + Amazon URLs).
  return {
    outputImage: edited.image,
    mimeType: edited.mimeType,
    products: stubProducts(), // STUB(B2.3/B2.4)
  };
}
