import type { ImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { generateFromImage } from '../ai/gemini.js';

/**
 * Model 1 — Gemini Flash-Lite VISION prompt enhancement (image + text → text).
 *
 * Sees the input image and rewrites the user's short request into ONE concise,
 * ADD-ONLY editing instruction for Model 2 (FLUX Kontext). The instruction adds a
 * small set of context-appropriate items and explicitly tells the editor to leave
 * the rest of the photo unchanged — so Kontext does not repaint the background.
 * Output is the rewritten instruction only.
 */

const SYSTEM_INSTRUCTION = `You write editing instructions for an AI image-editing model (FLUX Kontext) that ADDS furniture and decor to a photo of a real space. You are given the input image and the user's short request. Rewrite the request into ONE concise, additive editing instruction.

This is an ADD-ONLY edit. The editor must keep the original photo exactly as it is — the same background, sky, walls, floor and ground, existing plants, railings, buildings, structures, materials, colors, lighting, camera angle and perspective. Do NOT restyle, redesign, relight, or regenerate the scene, and never use words like "transform", "turn into", "convert", "redesign", or "makeover". You are only placing new objects into the existing scene.

Look at the image and identify the space (for example: terrace, balcony, rooftop, garden, patio, backyard, or an indoor room). Suggest only items that realistically belong in THAT space. For outdoor spaces, add only weatherproof / outdoor items (never indoor-only items like an indoor sofa, fireplace, or chandelier).

Add a realistic set of 5 to 8 distinct items that furnish the space as one coherent design. Do not overcrowd the scene — every item should have breathing room. Each item appears once: no duplicates and no repeating the same category. Use the existing scene as reference for placement (e.g. "against the left railing", "in the empty corner beside the door", "along the back wall"), and keep items in open or empty areas so nothing important in the photo is covered. Match the real-world scale, perspective, and lighting of the photo so each addition looks naturally placed with realistic contact shadows.

Output format:
- Write ONE cohesive paragraph (about 3 to 5 sentences) describing the fully furnished scene as a single connected arrangement — name every added item and where it sits, weaving them together (e.g. "a low lounge sofa along the back wall with a coffee table in front, flanked by two tall planters, a floor lamp in the left corner, and a woven rug beneath the seating"). Do NOT write a checklist of separate "Add X" sentences.
- Plain text only.
- End with exactly this sentence: "Keep the rest of the original image exactly as it is, unchanged."
- Do NOT mention the user, do NOT explain your reasoning, do NOT use markdown, headings, or bullet points. Output ONLY the editing instruction.`;

/**
 * Upper bound so a runaway response never bloats the downstream call. Generous
 * enough that a 5–8 item paragraph is never truncated before its final
 * "keep the rest unchanged" clause (truncating that clause would let Kontext
 * repaint the background).
 */
const MAX_ENHANCED_LENGTH = 2000;

export interface EnhancePromptInput {
  /** Input image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Input image mime (jpeg/png). */
  mimeType: ImageMime;
  /** The user's short edit request. */
  prompt: string;
}

export const enhancePromptStep: PipelineStep<EnhancePromptInput, string> = {
  name: 'enhancePrompt',
  async run({ image, mimeType, prompt }) {
    const enhanced = await generateFromImage({
      image,
      mimeType,
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      // No responseSchema → free-text output.
    });
    // `generateFromImage` already throws on empty; guard again defensively.
    if (!enhanced) {
      throw new Error('Prompt enhancement produced no output');
    }
    return enhanced.slice(0, MAX_ENHANCED_LENGTH);
  },
};
