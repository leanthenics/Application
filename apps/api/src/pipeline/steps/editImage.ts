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
  /**
   * Per-style fullness knob (0..1) — how many items nano adds. Resolved by the
   * runner from the chosen style (falls back to the global config.gemini.richness
   * when the style doesn't set its own). Optional so the step stays callable alone.
   */
  richness?: number;
  /**
   * Night mode: when true, the editor also relights the whole scene to night-time
   * (dark sky, lower ambient light, warm artificial lighting) instead of matching
   * the photo's existing daytime lighting. Geometry/structure stay preserved.
   */
  night?: boolean;
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
function composeEditPrompt(
  instruction: string,
  richness: number,
  scene?: SceneAnalysis,
  night = false,
): string {
  const preserve =
    scene && scene.fixedElements.length
      ? scene.fixedElements.join('; ')
      : 'the background, sky, walls, floor, ceiling, windows, doors, existing plants, and all fixed structures (pillars, columns, beams, railings)';
  const zones = scene?.editableZones
    .map((z) => `- ${z.location} — for ${z.suitableFor}`)
    .join('\n');

  if (night) return composeNightEditPrompt(instruction, richness, preserve, zones, scene);

  return [
    'This is a precise PHOTO-EDITING task, not image generation. You are given a real photograph. Keep the photograph exactly as it is and ONLY add new objects into specific empty areas. Do not redraw, regenerate, restyle, relight, or re-render any existing part of the photo.',
    '',
    'PRESERVE EXACTLY — keep these pixels unchanged; do not move, recolor, resize, relight, or replace any of them:',
    preserve + '.',
    ...(scene?.landscape ? [`Also keep the surrounding setting unchanged: ${scene.landscape}`] : []),
    'Also keep the exact camera angle, framing, perspective, zoom, and image dimensions identical to the original.',
    '',
    `WHAT TO ADD — ${richnessDirective(richness)} that fulfill this request, and nothing outside it: "${instruction}"`,
    ...(zones
      ? ['', 'Place the new items ONLY into these empty areas of the photo:', zones]
      : ['', 'Place the new items only into the clearly empty areas of the photo.']),
    '',
    "Integrate each added item realistically — correct scale and perspective, grounded contact shadows, and matching the photo's existing lighting direction, white balance, and sharpness — so it looks photographed in the same shot, not pasted in.",
    '',
    'Everything outside the newly added items must remain pixel-for-pixel identical to the original photograph.',
  ].join('\n');
}

/**
 * Night-mode variant. Unlike the day path (which forbids relighting and matches the
 * existing daytime light), night mode MUST globally relight the scene — so we can't
 * say "keep pixels identical". Instead we lock GEOMETRY (positions/shapes/sizes/
 * materials of every structure + object, and the exact camera/framing), while
 * explicitly asking for a nighttime re-light + warm artificial lighting. It also
 * still adds the styled garden items, biased toward evening-appropriate pieces and
 * tasteful lighting so the added items stay well-lit (and detectable by Model 4).
 */
function composeNightEditPrompt(
  instruction: string,
  richness: number,
  preserve: string,
  zones: string | undefined,
  scene?: SceneAnalysis,
): string {
  return [
    'This is a precise PHOTO-EDITING task on a real DAYTIME photograph. Do TWO things and nothing else: (1) add new objects into specific empty areas, and (2) change the TIME OF DAY to night by relighting the entire scene as one realistic nighttime photograph. Do NOT move, reshape, resize, replace, or restyle any existing structure or object, and do NOT change the camera.',
    '',
    'KEEP THE SAME PLACE — every existing structure and object must stay in the exact same position, shape, size, and material as the original:',
    preserve + '.',
    ...(scene?.landscape ? [`Keep the same surrounding setting (its layout is unchanged): ${scene.landscape}`] : []),
    'Keep the exact camera angle, framing, perspective, zoom, and image dimensions identical to the original.',
    '',
    'RE-LIGHT TO NIGHT: replace the daytime sky with a dark evening/night sky; lower the overall ambient light to a natural nighttime level; and add realistic artificial lighting — warm garden and landscape lights, lamps, glowing fixtures, and soft string/festoon lights — casting gentle warm pools of light and natural soft shadows. The scene must clearly read as nighttime while every structure stays recognizably the same place. This must look like one real photograph taken at night, NOT a daytime photo with a dark filter over it.',
    '',
    `WHAT TO ADD — ${richnessDirective(richness)} that fulfill this request, and nothing outside it: "${instruction}". Favor items that suit an evening garden and include tasteful, glowing lighting so the added pieces stay clearly lit.`,
    ...(zones
      ? ['', 'Place the new items ONLY into these empty areas of the photo:', zones]
      : ['', 'Place the new items only into the clearly empty areas of the photo.']),
    '',
    'Integrate each added item realistically — correct scale and perspective, grounded contact shadows, and lit consistently with the new nighttime lighting — so it looks photographed in the same shot, not pasted in.',
    '',
    'Do not add, remove, or relocate any existing structure. Only the lighting/time-of-day and the newly added items may change; every existing element keeps its exact position and form.',
  ].join('\n');
}

export const editImageStep: PipelineStep<EditImageInput, EditImageOutput> = {
  name: 'editImage',
  async run(input) {
    const dataUri = `data:${input.mimeType};base64,${input.image}`;
    // Per-style richness when the runner supplies it; else the global default.
    const richness = input.richness ?? config.gemini.richness;
    const night = input.night ?? false;
    console.log(`[editImage] richness=${richness} night=${night} → "${richnessDirective(richness)}"`);
    const { base64, mimeType } = await editImage({
      dataUri,
      prompt: composeEditPrompt(input.prompt, richness, input.scene, night),
      fallbackMime: input.mimeType,
    });
    // `editImage` already guards empty output; guard again defensively.
    if (!base64) {
      throw new Error('Image edit produced no output');
    }
    return { image: base64, mimeType };
  },
};
