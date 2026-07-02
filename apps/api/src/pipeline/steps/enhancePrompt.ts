import type { ImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { generateFromImage } from '../ai/gemini.js';

/**
 * Model 1 — Gemini Flash-Lite VISION prompt enhancement (image + text → text).
 *
 * Sees the input image and rewrites the user's short request into ONE concise,
 * ADD-ONLY editing instruction for Model 2 (FLUX Kontext). The instruction adds a
 * rich set of context-appropriate items (aiming for a full, furnished look) with a
 * deliberate warmth baked into the added items only (warm materials + local lamp
 * glow, never a global relight), and explicitly tells the editor to leave the rest
 * of the photo — background and fixed structures like concrete pillars — unchanged,
 * both at the top of the instruction and in the closing clause.
 * Output is the rewritten instruction only.
 */

/*
 * ─── PREVIOUS PROMPT (kept as a fallback; superseded 2026-07-02) ───
 * The version below produced good add-only results but (a) added no deliberate
 * warmth and (b) only had a single trailing preservation clause, so Kontext
 * sometimes still altered the background / fixed structures (concrete pillars etc).
 * To revert: paste this text back into the active SYSTEM_INSTRUCTION below.
 *
 * You write editing instructions for an AI image-editing model (FLUX Kontext) that ADDS furniture and decor to a photo of a real space. You are given the input image and the user's short request. Rewrite the request into ONE concise, additive editing instruction.
 *
 * This is an ADD-ONLY edit. The editor must keep the original photo exactly as it is — the same background, sky, walls, floor and ground, existing plants, railings, buildings, structures, materials, colors, lighting, camera angle and perspective. Do NOT restyle, redesign, relight, or regenerate the scene, and never use words like "transform", "turn into", "convert", "redesign", or "makeover". You are only placing new objects into the existing scene.
 *
 * Look at the image and identify the space (for example: terrace, balcony, rooftop, garden, patio, backyard, or an indoor room). Suggest only items that realistically belong in THAT space. For outdoor spaces, add only weatherproof / outdoor items (never indoor-only items like an indoor sofa, fireplace, or chandelier).
 *
 * Add a rich, generous set of 12 to 15 distinct items that furnish the space as one coherent, fully-furnished design. Make the space feel full, layered and lived-in — not sparse or empty — while keeping the arrangement realistic and the walking paths clear. Draw from several categories so the scene has depth: seating, tables/surfaces, lighting, planters and greenery, rugs/textiles, shade or overhead elements where appropriate, and smaller decor accents (cushions, lanterns, art, tableware). Avoid unnatural duplication or copy-pasted clones of the same object, but multiple pieces from a category are welcome where they realistically belong (for example a few chairs around a table, several planters, or a cluster of cushions). Use the existing scene as reference for placement (e.g. "against the left railing", "in the empty corner beside the door", "along the back wall"), and keep items in open or empty areas so nothing important in the photo is covered. Match the real-world scale, perspective, and lighting of the photo so each addition looks naturally placed with realistic contact shadows.
 *
 * Output format:
 * - Write ONE cohesive paragraph (about 5 to 7 sentences) describing the fully furnished scene as a single connected arrangement — name every added item and where it sits, weaving them together. Do NOT write a checklist of separate "Add X" sentences.
 * - Plain text only.
 * - End with exactly this sentence: "Keep the rest of the original image exactly as it is, unchanged."
 * - Do NOT mention the user, do NOT explain your reasoning, do NOT use markdown, headings, or bullet points. Output ONLY the editing instruction.
 * ─── END PREVIOUS PROMPT ───
 */

// ACTIVE prompt (2026-07-02): warmth scoped to the added items only + explicit
// immovable-structures preservation, stated at the top AND restated in the closing
// clause. 12–15 item count retained.
const SYSTEM_INSTRUCTION = `You write editing instructions for an AI image-editing model (FLUX Kontext) that ADDS furniture and decor to a photo of a real space. You are given the input image and the user's short request. Rewrite the request into ONE concise, additive editing instruction.

CRITICAL — preserve the original photo exactly. This is an ADD-ONLY edit: you are only placing new objects into the existing scene. Every existing element must stay exactly as it is — the background, sky, walls, floor and ground, ceiling, windows and doors, existing plants, and especially fixed structural elements such as concrete pillars, columns, beams, and railings. Do NOT recolor, retexture, relight, move, remove, resize, or regenerate any of these. Treat all existing structures as immovable: place new items around them and in front of them, never over, replacing, or altering them. Never use words like "transform", "turn into", "convert", "restyle", "redesign", "makeover", or "relight" — you are not changing the scene, only adding to it.

Look at the image and identify the space (for example: terrace, balcony, rooftop, garden, patio, backyard, or an indoor room). Suggest only items that realistically belong in THAT space. For outdoor spaces, add only weatherproof / outdoor items (never indoor-only items like an indoor sofa, fireplace, or chandelier).

Add a rich, generous set of 12 to 15 distinct items that furnish the space as one coherent, fully-furnished design. Make the space feel full, layered and lived-in — not sparse or empty — while keeping the arrangement realistic and the walking paths clear. Draw from several categories so the scene has depth: seating, tables/surfaces, lighting, planters and greenery, rugs/textiles, shade or overhead elements where appropriate, and smaller decor accents (cushions, lanterns, art, tableware). Avoid unnatural duplication or copy-pasted clones of the same object, but multiple pieces from a category are welcome where they realistically belong (for example a few chairs around a table, several planters, or a cluster of cushions). Use the existing scene as reference for placement (e.g. "against the left railing", "in the empty corner beside the door", "along the back wall"), and keep items in open or empty areas so nothing important in the photo is covered. Match the real-world scale, perspective, and lighting of the photo so each addition looks naturally placed with realistic contact shadows.

Give the added furnishings a warm, inviting, natural feel: favor warm materials and tones — warm woods, rattan and cane, terracotta, and soft amber, ochre and cream textiles. Any lamps, lanterns, or string lights you add should cast a soft, warm glow only on and immediately around themselves; do NOT use them to relight or recolor the existing scene. The warmth must come from the added items themselves, never from changing the photo's overall lighting or color.

Output format:
- Write ONE cohesive paragraph (about 5 to 7 sentences) describing the fully furnished scene as a single connected arrangement — name every added item and where it sits, weaving them together (e.g. "a low lounge sofa along the back wall with a coffee table in front, flanked by two tall planters, a floor lamp in the left corner, and a woven rug beneath the seating"). Do NOT write a checklist of separate "Add X" sentences.
- Plain text only.
- End with exactly this sentence: "Add only these new items and keep everything else in the original photo — the background, sky, walls, floor, concrete pillars and all existing structures — exactly as it is, completely unchanged."
- Do NOT mention the user, do NOT explain your reasoning, do NOT use markdown, headings, or bullet points. Output ONLY the editing instruction.`;

/**
 * Upper bound so a runaway response never bloats the downstream call. Generous
 * enough that a 12–15 item paragraph is never truncated before its final
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
