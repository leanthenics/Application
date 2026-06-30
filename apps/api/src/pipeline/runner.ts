import type { JobResult, Product } from '@clickretina/contract';
import { config } from '../config.js';
import type { JobData } from '../jobs/shared.js';
import type { PipelineContext } from './context.js';
import { runStep } from './step.js';
import { enhancePromptStep } from './steps/enhancePrompt.js';
import { editImageStep } from './steps/editImage.js';
import { extractKeytermsStep } from './steps/extractKeyterms.js';

/**
 * The 3-model pipeline (architecture §4). Built one model at a time; the public
 * `JobResult` contract stays stable as stubs are replaced.
 *
 *   1. enhancePrompt   (Gemini Flash-Lite)        — REAL (B2.1)
 *   2. editImage       (Replicate Qwen Image 2.0) — REAL (B2.2)
 *   3. extractKeyterms (Gemini Flash-Lite vision) — REAL (B2.3)
 *   4. Amazon URLs     (affiliate link builder)   — TODO(B2.4): inline stub (final URL shape)
 */

// ── TODO(B2.4) stub: final affiliate URL shape (architecture §5 / decision 5). ──
function stubAmazonUrl(keyterm: string): string {
  return `https://www.amazon.${config.amazon.tld}/s?k=${encodeURIComponent(keyterm)}&tag=${encodeURIComponent(config.amazon.affiliateTag)}`;
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

  // Step 3 — REAL: read shoppable product key-terms from the edited image.
  const keyterms = await runStep(
    extractKeytermsStep,
    { image: edited.image, mimeType: edited.mimeType },
    ctx,
  );

  // Step 4 — STUB(B2.4): build the affiliate URL for each key-term (final shape).
  const products: Product[] = keyterms.map((keyterm) => ({
    keyterm,
    amazonUrl: stubAmazonUrl(keyterm),
  }));

  return {
    outputImage: edited.image,
    mimeType: edited.mimeType,
    products,
  };
}
