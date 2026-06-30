import type { ImageMime, OutputImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { editImage } from '../ai/replicate.js';

/**
 * Model 2 — Replicate Qwen Image 2.0 image edit (image + prompt → image).
 *
 * Feeds the (already Gemini-enhanced) prompt + the user's input image to Qwen and
 * returns the real edited image. The input image arrives as raw base64 (no
 * data-uri prefix, per architecture §6) and was already resized client-side.
 */

export interface EditImageInput {
  /** Input image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Input image mime (jpeg/png). */
  mimeType: ImageMime;
  /** The enhanced edit instruction from Model 1. */
  prompt: string;
}

export interface EditImageOutput {
  /** Edited image bytes, base64. */
  image: string;
  /** Edited image's content-type (may be webp). */
  mimeType: OutputImageMime;
}

export const editImageStep: PipelineStep<EditImageInput, EditImageOutput> = {
  name: 'editImage',
  async run(input) {
    const dataUri = `data:${input.mimeType};base64,${input.image}`;
    const { base64, mimeType } = await editImage({
      dataUri,
      prompt: input.prompt,
      fallbackMime: input.mimeType,
    });
    // `editImage` already guards empty output; guard again defensively.
    if (!base64) {
      throw new Error('Image edit produced no output');
    }
    return { image: base64, mimeType };
  },
};
