import type { ImageMime, OutputImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { config } from '../../config.js';
import { editImage } from '../ai/replicate.js';
import type { SceneAnalysis } from './analyzeScene.js';

/**
 * Model 3 — Replicate image edit (image + prompt → image), currently nano-banana.
 *
 * Feeds the (Model 2-enhanced) instruction + the user's input image to the editor
 * and returns the real edited image. The input image arrives as raw base64 (no
 * data-uri prefix, per architecture §6) and was already resized client-side.
 *
 * We also hand it Model 1's scene analysis so the prompt can name the exact
 * editable zones (positive/semantic masking — "add into these areas") and the exact
 * fixed elements to preserve, which nano follows better than a generic "don't
 * change anything" instruction. Target: original background/structures ~80–90%+ intact.
 */

export interface EditImageInput {
  /** Input image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Input image mime (jpeg/png). */
  mimeType: ImageMime;
  /** The enhanced edit instruction from Model 2. */
  prompt: string;
  /** Model 1's scene analysis (editable zones + fixed elements). */
  scene: SceneAnalysis;
}

export interface EditImageOutput {
  /** Edited image bytes, base64. */
  image: string;
  /** Edited image's content-type (may be webp). */
  mimeType: OutputImageMime;
}

/**
 * Map the 0..1 richness knob to how MANY fitting items nano should add. nano invents
 * the actual pieces (all on-theme with the instruction), so we steer quantity with
 * words + an explicit count range (vague adjectives alone don't move nano much). Lives
 * here (Model 3), not in Model 2 — Model 2 only clarifies the request; Model 3 decides
 * fullness + preservation. Non-finite input (bad env) falls back to the mid default.
 */
function richnessDirective(richness: number): string {
  const r = Number.isFinite(richness) ? richness : 0.6;
  if (r < 0.25) return 'Add just a few (about 2 to 4) key items and keep most of the space open and uncluttered';
  if (r < 0.5) return 'Add a modest set (about 5 to 7) of tasteful items, leaving some open breathing space';
  if (r < 0.8) return 'Add a full set (about 8 to 12) of items so the space feels well-designed and complete';
  return 'Add a rich, generous amount (a dozen or more) of items to densely and fully fill the space';
}

/**
 * Preservation-first prompt for nano. Model 2 gives the enhanced request (what the
 * user wants); Model 1 gives the exact things to PRESERVE and the empty zones to add
 * INTO. We compose these in code — every run, so nothing is dropped or truncated —
 * leading with a hard "keep the photograph identical" instruction (nano's editing
 * mindset), then telling it precisely what to keep, what to add, and where. This is the
 * positive/semantic-masking approach: naming the empty zones + the locked elements is
 * what keeps the original background ~80–90%+ intact. `scene` is optional so this stays
 * callable in isolation, but the runner always provides it.
 */
function composeEditPrompt(instruction: string, scene?: SceneAnalysis): string {
  const preserve =
    scene && scene.fixedElements.length
      ? scene.fixedElements.join('; ')
      : 'the background, sky, walls, floor, ceiling, windows, doors, existing plants, and all fixed structures (pillars, columns, beams, railings)';
  const zones = scene?.editableZones
    .map((z) => `- ${z.location} — for ${z.suitableFor}`)
    .join('\n');

  return [
    'This is a precise PHOTO-EDITING task, not image generation. You are given a real photograph. Keep the photograph exactly as it is and ONLY add new objects into specific empty areas. Do not redraw, regenerate, restyle, relight, or re-render any existing part of the photo.',
    '',
    'PRESERVE EXACTLY — keep these pixels unchanged; do not move, recolor, resize, relight, or replace any of them:',
    preserve + '.',
    ...(scene?.landscape ? [`Also keep the surrounding setting unchanged: ${scene.landscape}`] : []),
    'Also keep the exact camera angle, framing, perspective, zoom, and image dimensions identical to the original.',
    '',
    `WHAT TO ADD — ${richnessDirective(config.gemini.richness)} that fulfill this request, and nothing outside it: "${instruction}"`,
    ...(zones
      ? ['', 'Place the new items ONLY into these empty areas of the photo:', zones]
      : ['', 'Place the new items only into the clearly empty areas of the photo.']),
    '',
    "Integrate each added item realistically — correct scale and perspective, grounded contact shadows, and matching the photo's existing lighting direction, white balance, and sharpness — so it looks photographed in the same shot, not pasted in.",
    '',
    'Everything outside the newly added items must remain pixel-for-pixel identical to the original photograph.',
  ].join('\n');
}

export const editImageStep: PipelineStep<EditImageInput, EditImageOutput> = {
  name: 'editImage',
  async run(input) {
    const dataUri = `data:${input.mimeType};base64,${input.image}`;
    console.log(
      `[editImage] richness=${config.gemini.richness} → "${richnessDirective(config.gemini.richness)}"`,
    );
    const { base64, mimeType } = await editImage({
      dataUri,
      prompt: composeEditPrompt(input.prompt, input.scene),
      fallbackMime: input.mimeType,
    });
    // `editImage` already guards empty output; guard again defensively.
    if (!base64) {
      throw new Error('Image edit produced no output');
    }
    return { image: base64, mimeType };
  },
};
