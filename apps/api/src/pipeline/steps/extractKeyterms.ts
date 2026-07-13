import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { OutputImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { generateFromImage } from '../ai/gemini.js';

/**
 * Model 4 — Gemini Flash vision product extraction (image → grouped products).
 *
 * Reads the EDITED image and returns the shoppable garden items GROUPED under
 * AI-chosen category labels, each with an approximate INR price range. The model
 * emits the whole grouped structure in a SINGLE pass, so it names each group once
 * and buckets items coherently — this is what prevents near-duplicate groups like
 * "Lights" vs "Lighting" (independent per-item tagging is what causes those).
 *
 * These feed `ProductGroup`/`Product`; the Amazon URL is built downstream (runner).
 * The step is NON-FATAL at the pipeline level: on error or empty it throws, and the
 * runner falls back to `FALLBACK_PRODUCT_GROUPS` so a good edited image still ships.
 */

export interface ExtractKeytermsInput {
  /** Edited image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Edited image content-type. */
  mimeType: OutputImageMime;
}

/** One shoppable item (Amazon URL is added later by the runner). */
export interface ExtractedItem {
  keyterm: string;
  priceMin?: number;
  priceMax?: number;
}

/** A group of items under one AI-generated category label. */
export interface ExtractedGroup {
  group: string;
  items: ExtractedItem[];
}

const SYSTEM_INSTRUCTION = [
  'You are a garden/outdoor-decor shopping expert analysing a redesigned outdoor space.',
  'Identify the most prominent SHOPPABLE items a user could buy to recreate this look',
  '(plants, planters, lighting, seating/furniture, shade structures, water features, rugs/textiles, decor).',
  'GROUP the items under short, natural category names that YOU choose based on what you see.',
  'Decide the whole grouping in one go: give each category ONE name and put every related item under it —',
  'never create two groups that mean the same thing (e.g. do not output both "Lights" and "Lighting"; merge them).',
  'For each item return ONE concise, search-ready term a shopper could paste into Amazon —',
  'describe material, color, and style (e.g. "solar garden path lights", "rattan outdoor lounge chair").',
  'No brand names, no duplicates, no descriptions of the space/background.',
  'For each item also estimate an approximate price range in Indian Rupees (INR) as two numbers,',
  'priceMin and priceMax (whole rupees, general ballpark — accuracy is not important, just a sensible range).',
  'Order groups and items most-prominent first.',
].join(' ');

/** Hard safety cap on total items across all groups (model decides the actual count). */
const MAX_ITEMS = 15;

/** Structured-output schema: an array of groups, each with an array of priced items. */
const PRODUCT_GROUPS_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      group: { type: Type.STRING },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            keyterm: { type: Type.STRING },
            priceMin: { type: Type.NUMBER },
            priceMax: { type: Type.NUMBER },
          },
          required: ['keyterm', 'priceMin', 'priceMax'],
        },
      },
    },
    required: ['group', 'items'],
  },
};

const ItemResponse = z.object({
  keyterm: z.string(),
  priceMin: z.number(),
  priceMax: z.number(),
});
const GroupsResponse = z.array(
  z.object({
    group: z.string(),
    items: z.array(ItemResponse),
  }),
);

/**
 * Curated fallback used by the runner when Model 4 errors or finds nothing. Gemini
 * has a history of transient failures; the shopping list is the LAST step, so a
 * hiccup here must not cost the user their edited image. Real affiliate URLs are
 * built from these keyterms downstream, so the links still work.
 */
export const FALLBACK_PRODUCT_GROUPS: ExtractedGroup[] = [
  {
    group: 'Plants & Greenery',
    items: [
      { keyterm: 'potted areca palm plant', priceMin: 300, priceMax: 1200 },
      { keyterm: 'ornamental outdoor fern plant', priceMin: 200, priceMax: 800 },
    ],
  },
  {
    group: 'Planters & Pots',
    items: [{ keyterm: 'ceramic outdoor planter pot', priceMin: 500, priceMax: 2500 }],
  },
  {
    group: 'Lighting',
    items: [
      { keyterm: 'solar garden path lights', priceMin: 600, priceMax: 2000 },
      { keyterm: 'outdoor string lights', priceMin: 500, priceMax: 1800 },
    ],
  },
  {
    group: 'Seating & Furniture',
    items: [{ keyterm: 'rattan outdoor lounge chair', priceMin: 4000, priceMax: 12000 }],
  },
];

/**
 * Pull the estimated MIN down a bit so the range starts at a more appealing (and
 * often more realistic budget) entry price — Gemini tends to over-estimate the low
 * end. Applied to priceMin only; priceMax is left as the model gave it. Round the
 * reduced min to a clean-looking number.
 */
const MIN_PRICE_FACTOR = 0.7;
const roundNice = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

/** Normalize an AI price pair: keep only sane, ordered, non-negative numbers. */
function normalizePrice(min: number, max: number): { priceMin?: number; priceMax?: number } {
  let lo = Math.round(min);
  const hi = Math.round(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < 0) return {};
  // Tolerate a swapped range from the model, then discount the low end.
  const [rawLo, rawHi] = lo <= hi ? [lo, hi] : [hi, lo];
  lo = Math.max(0, roundNice(rawLo * MIN_PRICE_FACTOR));
  return { priceMin: lo, priceMax: rawHi };
}

export const extractKeytermsStep: PipelineStep<ExtractKeytermsInput, ExtractedGroup[]> = {
  name: 'extractKeyterms',
  async run(input) {
    const raw = await generateFromImage({
      image: input.image,
      mimeType: input.mimeType,
      prompt: 'List the shoppable products in this image, grouped by category, with an INR price range each.',
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: PRODUCT_GROUPS_SCHEMA,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Product extraction returned invalid JSON');
    }
    const groups = GroupsResponse.parse(parsed);

    // Merge groups by normalized (lowercase) name — a safety net against the model
    // still splitting synonyms. Dedupe keyterms case-insensitively across ALL groups
    // (first occurrence wins), cap the total number of items.
    const byGroup = new Map<string, ExtractedGroup>();
    const seenTerms = new Set<string>();
    let total = 0;

    outer: for (const g of groups) {
      const groupName = g.group.trim();
      if (!groupName) continue;
      for (const it of g.items) {
        const term = it.keyterm.trim();
        if (!term) continue;
        const termKey = term.toLowerCase();
        if (seenTerms.has(termKey)) continue;
        seenTerms.add(termKey);

        const groupKey = groupName.toLowerCase();
        let bucket = byGroup.get(groupKey);
        if (!bucket) {
          bucket = { group: groupName, items: [] };
          byGroup.set(groupKey, bucket);
        }
        bucket.items.push({ keyterm: term, ...normalizePrice(it.priceMin, it.priceMax) });

        if (++total >= MAX_ITEMS) break outer;
      }
    }

    const cleaned = [...byGroup.values()].filter((g) => g.items.length > 0);

    // No detectable products → throw; the runner catches this and uses the fallback
    // groups (this step is deliberately non-fatal at the pipeline level).
    if (cleaned.length === 0) {
      throw new Error('No products detected in the image');
    }
    return cleaned;
  },
};
