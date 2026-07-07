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

/**
 * Preservation wrapper. Model 1 gives us only the plan of additions; Model 2 must be
 * told — every run, in code so it can't be dropped or truncated — to treat this as an
 * ADD-ONLY edit and leave the original scene untouched. Sandwiches Model 1's rendered
 * plan between an "add these, integrated naturally" intro and the preservation clause.
 */
function composeEditPrompt(plan: string): string {
  return [
    'Keep the original photo exactly as it is and ADD the objects listed below into it. Treat the input as a fixed background photograph — do not regenerate or re-render it, only place new objects on top of it.',
    '',
    'Objects to add, each integrated naturally into the scene with correct scale, perspective, and realistic contact shadows:',
    '',
    plan,
    '',
    'Strict preservation rules:',
    '- The result must look like the exact same photograph with only the new items added; every original pixel outside the added items must stay identical.',
    '- Do not change, move, recolor, relight, resize, or regenerate anything already in the photo — the background, sky, walls, floor, ceiling, windows, doors, existing plants, and all fixed structures (pillars, columns, beams, railings) stay exactly as they are.',
    '- Do not crop, zoom, rotate, or change the camera angle, framing, or aspect ratio; return the image at the same dimensions as the input.',
    "- Match the original photo's existing lighting, shadow direction, white balance, color grade, and image sharpness so the added items look like they were photographed in the same shot, not pasted in.",
    '- Only add the items described above; leave everything else in the original photo completely unchanged.',
  ].join('\n');
}

export const editImageStep: PipelineStep<EditImageInput, EditImageOutput> = {
  name: 'editImage',
  async run(input) {
    const dataUri = `data:${input.mimeType};base64,${input.image}`;
    const { base64, mimeType } = await editImage({
      dataUri,
      prompt: composeEditPrompt(input.prompt),
      fallbackMime: input.mimeType,
    });
    // `editImage` already guards empty output; guard again defensively.
    if (!base64) {
      throw new Error('Image edit produced no output');
    }
    return { image: base64, mimeType };
  },
};
