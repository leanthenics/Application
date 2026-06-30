import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { OutputImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { generateFromImage } from '../ai/gemini.js';

/**
 * Model 3 — Gemini Flash-Lite vision key-term extraction (image → string[]).
 *
 * Reads the EDITED image and returns up to 5 descriptive, search-ready product
 * key-terms for the most prominent shoppable furniture/decor. These feed
 * `Product.keyterm`; the Amazon URL is built downstream (B2.4).
 */

export interface ExtractKeytermsInput {
  /** Edited image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Edited image content-type. */
  mimeType: OutputImageMime;
}

const SYSTEM_INSTRUCTION = [
  'You are an interior/product vision expert for a furniture shopping app.',
  'Look at the image and identify the most prominent SHOPPABLE furniture and decor items',
  '(seating, tables, lighting, rugs, plants, wall art, storage).',
  'For each, return ONE concise, search-ready term a shopper could paste into Amazon —',
  'describe material, color, and style (e.g. "mid-century tan leather sofa", "arc brass floor lamp").',
  'No brand names, no prices, no duplicates, no room/background descriptions.',
  'Return at most 5 items, most prominent first.',
].join(' ');

/** Hard cap (architecture: up to 5 products). */
const MAX_KEYTERMS = 5;

/** Structured-output schema: a JSON array of strings. */
const KEYTERMS_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
};

const KeytermsResponse = z.array(z.string());

export const extractKeytermsStep: PipelineStep<ExtractKeytermsInput, string[]> = {
  name: 'extractKeyterms',
  async run(input) {
    const raw = await generateFromImage({
      image: input.image,
      mimeType: input.mimeType,
      prompt: 'List the shoppable products in this image.',
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: KEYTERMS_SCHEMA,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Key-term extraction returned invalid JSON');
    }
    const terms = KeytermsResponse.parse(parsed);

    // Normalize: trim, drop empties, dedupe case-insensitively, cap to MAX_KEYTERMS.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const t of terms) {
      const term = t.trim();
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(term);
      if (cleaned.length >= MAX_KEYTERMS) break;
    }

    // Decision: no detectable products → fail the job (fail-fast).
    if (cleaned.length === 0) {
      throw new Error('No products detected in the image');
    }
    return cleaned;
  },
};
