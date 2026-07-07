import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { config } from '../../config.js';
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
// prompt 2 :
// `You write editing instructions for an AI image-editing model (FLUX Kontext) that ADDS furniture and decor to a photo of a real space. You are given the input image and the user's short request. Rewrite the request into ONE concise, additive editing instruction.

// CRITICAL — preserve the original photo exactly. This is an ADD-ONLY edit: you are only placing new objects into the existing scene. Every existing element must stay exactly as it is — the background, sky, walls, floor and ground, ceiling, windows and doors, existing plants, and especially fixed structural elements such as concrete pillars, columns, beams, and railings. Do NOT recolor, retexture, relight, move, remove, resize, or regenerate any of these. Treat all existing structures as immovable: place new items around them and in front of them, never over, replacing, or altering them. Never use words like "transform", "turn into", "convert", "restyle", "redesign", "makeover", or "relight" — you are not changing the scene, only adding to it.

// Look at the image and identify the space (for example: terrace, balcony, rooftop, garden, patio, backyard, or an indoor room). Suggest only items that realistically belong in THAT space. For outdoor spaces, add only weatherproof / outdoor items (never indoor-only items like an indoor sofa, fireplace, or chandelier).

// Add a rich, generous set of 12 to 15 distinct items that furnish the space as one coherent, fully-furnished design. Make the space feel full, layered and lived-in — not sparse or empty — while keeping the arrangement realistic and the walking paths clear. Draw from several categories so the scene has depth: seating, tables/surfaces, lighting, planters and greenery, rugs/textiles, shade or overhead elements where appropriate, and smaller decor accents (cushions, lanterns, art, tableware). Avoid unnatural duplication or copy-pasted clones of the same object, but multiple pieces from a category are welcome where they realistically belong (for example a few chairs around a table, several planters, or a cluster of cushions). Use the existing scene as reference for placement (e.g. "against the left railing", "in the empty corner beside the door", "along the back wall"), and keep items in open or empty areas so nothing important in the photo is covered. Match the real-world scale, perspective, and lighting of the photo so each addition looks naturally placed with realistic contact shadows.

// Give the added furnishings a warm, inviting, natural feel: favor warm materials and tones — warm woods, rattan and cane, terracotta, and soft amber, ochre and cream textiles. Any lamps, lanterns, or string lights you add should cast a soft, warm glow only on and immediately around themselves; do NOT use them to relight or recolor the existing scene. The warmth must come from the added items themselves, never from changing the photo's overall lighting or color.

// Output format:
// - Write ONE cohesive paragraph (about 5 to 7 sentences) describing the fully furnished scene as a single connected arrangement — name every added item and where it sits, weaving them together (e.g. "a low lounge sofa along the back wall with a coffee table in front, flanked by two tall planters, a floor lamp in the left corner, and a woven rug beneath the seating"). Do NOT write a checklist of separate "Add X" sentences.
// - Plain text only.
// - End with exactly this sentence: "Add only these new items and keep everything else in the original photo — the background, sky, walls, floor, concrete pillars and all existing structures — exactly as it is, completely unchanged."
// - Do NOT mention the user, do NOT explain your reasoning, do NOT use markdown, headings, or bullet points. Output ONLY the editing instruction.
/*
 * ─── PREVIOUS PROMPT (free-text designer plan; superseded by the JSON plan below) ───
 * Kept as a labeled fallback. Produced good add-only suggestions, but as unstructured
 * text — so per-item copy counts and the total item count could not be enforced in code.
 *
 * You are an expert interior and exterior designer.
 * The uploaded image is provided only so you can understand the space.
 * Your task is to analyze the image and the user's request, then decide what objects,
 * furniture, decor, plants, lighting, or accessories should be added to improve the space.
 * For every suggested item, specify what to add and where it should be placed.
 * (…full rules + example, see git history…)
 * ─── END PREVIOUS PROMPT ───
 */

/**
 * Item-count range for Model 1's plan, env-tunable (MODEL1_MIN_ITEMS / MODEL1_MAX_ITEMS)
 * so we can sweep for the quantity-vs-preservation sweet spot. `MAX_ITEMS` also clamps the
 * rendered plan; both the instruction and the clamp read the same numbers.
 */
const MIN_ITEMS = config.gemini.model1MinItems;
const MAX_ITEMS = config.gemini.model1MaxItems;
/** Max copies of any single item (only small repeatable decor should hit this). */
const MAX_COPIES = 4;

// ACTIVE prompt: Model 1 is a pure designer that returns a STRUCTURED plan (JSON).
// We validate + clamp it in code (copy cap, item cap) and render it to a natural-language
// paragraph for Model 2; the "preserve the original scene" clause is added by the
// editImage step (in code), NOT here — Model 1 only decides what to add and where.
const SYSTEM_INSTRUCTION = `You are an expert interior and exterior designer.

The uploaded image is provided only so you can understand the space (its type, layout, and empty areas).

Decide which products to ADD. The USER'S REQUEST is the primary driver — read it carefully and choose products that directly serve it.

Interpreting the request:
- If it names a theme, purpose, or product type ("rooftop garden", "reading nook", "dining area", "add plants"), add ONLY products that fit that intent. A "rooftop garden" means greenery and garden elements — planters, pots, raised beds, climbing plants, small trees, a trellis or pergola, garden lighting, a gravel or wood-deck path, a water feature — NOT sofas, coffee tables, or living-room seating unless the user asks for them.
- If it is vague ("make it aesthetic", "make it modern", "improve this"), THEN infer a fitting, fully-furnished design for that type of space.

Rules:
- Only add products that (a) serve the request and (b) realistically belong in the detected space (weatherproof/outdoor items for terraces, balconies, gardens, rooftops; indoor items for rooms). Never add an item just to fill space.
- NEVER add seating sets, sofas, lounge chairs, coffee tables, poufs, or ottomans unless the request explicitly involves seating, lounging, relaxing, or dining. A gardening or greenery request (e.g. "rooftop garden") gets plants, planters, beds, trellises, and garden features — NOT a lounge set. When in doubt, leave seating out and stay focused on the requested theme.
- Be thorough and generous: return at least ${MIN_ITEMS} and up to ${MAX_ITEMS} distinct items that FULLY realize the requested theme. A well-designed space has many pieces — when the plan feels complete, look again for relevant items you missed (more plant varieties, planters of different sizes, lighting, pathways, decor, textiles, and accessories that fit the theme). Do NOT stop at just a few. The only limit is relevance: never add items that don't serve the request or the space, but within the theme be as comprehensive as possible.
- "count" is how many copies of that item to place. Use count 1 for most items. Use a count of 2 to 4 ONLY for small, naturally repeatable pieces — planters/pots, cushions, chairs, stools, lanterns, candles. Large or unique items (pergola, sofa, dining table, rug, bed) must always be count 1.
- For each item, "placement" must reference the real scene ("along the back wall", "in the empty left corner", "beside the door").
- Keep everything realistic and proportional; do not block walkways or entrances.
- Do not mention preserving, changing, or removing anything already in the space. Describe only the additions.`;

/** Structured-output schema: a plan of items, each with a placement and a copy count. */
const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          placement: { type: Type.STRING },
          count: { type: Type.INTEGER },
        },
        required: ['item', 'placement', 'count'],
      },
    },
  },
  required: ['items'],
};

const PlanResponse = z.object({
  items: z.array(
    z.object({
      item: z.string(),
      placement: z.string(),
      count: z.number().int(),
    }),
  ),
});

export interface EnhancePromptInput {
  /** Input image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Input image mime (jpeg/png). */
  mimeType: ImageMime;
  /** The user's short edit request. */
  prompt: string;
}

/** Render one plan item as a fragment, e.g. "3 tall planters along the parapet". */
function renderItem(item: string, placement: string, count: number): string {
  // The model supplies the item text (usually already in a natural plural-friendly
  // form), so prefix the count only when >1 rather than pluralizing ourselves — the
  // latter produced double plurals like "planterses" / "lanternses".
  const noun = count > 1 ? `${count} ${item}` : item;
  return `${noun} ${placement}`.trim();
}

/**
 * Model 1 returns a STRUCTURED plan (JSON). We validate it, clamp per-item copy counts
 * and the total item count in code, then render it to one natural-language paragraph for
 * Model 2 (image editors follow prose far better than raw JSON). The "preserve the
 * original scene" clause is added downstream by the editImage step, not here.
 */
export const enhancePromptStep: PipelineStep<EnhancePromptInput, string> = {
  name: 'enhancePrompt',
  async run({ image, mimeType, prompt }) {
    const raw = await generateFromImage({
      image,
      mimeType,
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: PLAN_SCHEMA,
      model: config.gemini.model1,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Prompt enhancement returned invalid JSON');
    }
    const { items } = PlanResponse.parse(parsed);

    // Normalize: trim, drop empties, clamp copies to [1, MAX_COPIES], cap item count.
    const fragments: string[] = [];
    for (const { item, placement, count } of items) {
      const name = item.trim();
      const where = placement.trim();
      if (!name || !where) continue;
      const copies = Math.min(Math.max(Math.trunc(count) || 1, 1), MAX_COPIES);
      fragments.push(renderItem(name, where, copies));
      if (fragments.length >= MAX_ITEMS) break;
    }

    if (fragments.length === 0) {
      throw new Error('Prompt enhancement produced no items');
    }
    return `Add ${fragments.join(', ')}.`;
  },
};
