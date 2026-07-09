import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ImageMime } from '@clickretina/contract';
import type { PipelineStep } from '../step.js';
import { config } from '../../config.js';
import { generateFromImage } from '../ai/gemini.js';

/**
 * Model 1 — Gemini Flash VISION scene analysis (image → structured JSON).
 *
 * Looks at the ORIGINAL user photo of an outdoor space / garden and returns a rich,
 * structured analysis: what the space and surrounding landscape are, an exhaustive
 * list of what must be PRESERVED, neutral factual observations about the image, and
 * the **editable zones** where new items may go — phrased *positively* ("empty ground
 * front-left — fits large planters") rather than as a list of things not to touch.
 * This is the "positive/semantic masking" the image editor (nano-banana) follows best:
 * telling it WHERE it may add implies everything else stays. Model 1 does NOT design or
 * pick products — it only understands the space; Model 2 shapes the user's request
 * (styled) and nano invents the actual pieces.
 *
 * ─── PREVIOUS ROLE (kept for reference; superseded by the scene/enhance split) ───
 * Model 1 used to be a "designer" that returned a JSON plan of items (item/placement/
 * count, 12–16 items). That over-loaded one model with understanding + curating, and
 * the long "add all of this" plan drove background drift. The full designer prompt +
 * plan schema live in git history (see enhancePrompt.ts before this change).
 * ─── END PREVIOUS ROLE ───
 */

const SYSTEM_INSTRUCTION = `You are a spatial analyst for a GARDEN / outdoor-space design pipeline. A later model will ADD new garden features into this exact photograph while keeping everything else pixel-for-pixel identical. Your analysis tells it precisely WHAT to keep and WHERE the empty space is, so be concrete, complete, and spatially specific.

You are given a photo of a real outdoor space (a rooftop, terrace, balcony, backyard, patio, garden, or similar). Analyze it only — do NOT design it, and do NOT choose, suggest, or name any plants, furniture, features, or products to add.

Return:
- spaceType: a short label for the space (e.g. "open rooftop terrace", "small back garden", "narrow balcony").
- setting: "indoor" or "outdoor" (almost always "outdoor" here).
- description: 1–2 factual sentences describing the space exactly as it appears now (layout, what is already there).
- landscape: the wider setting — the ground/surface type, terrain, aspect and sun exposure, the surroundings and any views (e.g. "flat grey concrete rooftop, open to the sky, city skyline beyond the rear parapet, full sun"), and any existing greenery already present.
- observations: a list of 3–6 short, neutral factual notes about the image (its current condition, materials, scale, constraints, and empty potential) — plain observations only, NOT design suggestions and NOT products.
- fixedElements: an EXHAUSTIVE, concrete list of everything already visible that must be preserved unchanged — every structural/permanent feature (walls, ground/floor surface, sky, buildings, windows, doors, pillars, columns, beams, railings, parapets, steps, paths) AND every object already present (existing plants, trees, built-ins, fixtures, furniture already there). Name each specifically and note where it is (e.g. "grey concrete floor", "white parapet wall along the right edge", "metal railing at the back", "existing potted plant in the left corner"). This list is used to lock those pixels — do not miss anything prominent.
- lighting: the current lighting in plain words (e.g. "bright midday sun from the left, soft shadows").
- style: the existing palette / materials / mood (e.g. "bare grey concrete, minimal, unplanted").
- editableZones: ONLY the genuinely empty, open areas where new features could physically be placed, described POSITIVELY and precisely. For each zone give: location (exactly where it is in the frame — "empty ground in the front-center", "open strip along the back-left parapet"), description (what is there now / why it's free), and suitableFor (the KIND of thing that fits by size/position — e.g. "large floor planters or a small tree", "low ground-level planting", "climbing plants against the wall" — NOT a specific product).

Do not invent zones that don't exist in the photo. Return at least one editable zone.`;

/** Structured-output schema for the scene analysis. */
const SCENE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    spaceType: { type: Type.STRING },
    setting: { type: Type.STRING, enum: ['indoor', 'outdoor'] },
    description: { type: Type.STRING },
    landscape: { type: Type.STRING },
    observations: { type: Type.ARRAY, items: { type: Type.STRING } },
    fixedElements: { type: Type.ARRAY, items: { type: Type.STRING } },
    lighting: { type: Type.STRING },
    style: { type: Type.STRING },
    editableZones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING },
          description: { type: Type.STRING },
          suitableFor: { type: Type.STRING },
        },
        required: ['location', 'description', 'suitableFor'],
      },
    },
  },
  required: [
    'spaceType',
    'setting',
    'description',
    'landscape',
    'observations',
    'fixedElements',
    'lighting',
    'style',
    'editableZones',
  ],
};

const SceneResponse = z.object({
  spaceType: z.string(),
  setting: z.enum(['indoor', 'outdoor']),
  description: z.string(),
  landscape: z.string(),
  observations: z.array(z.string()),
  fixedElements: z.array(z.string()),
  lighting: z.string(),
  style: z.string(),
  editableZones: z.array(
    z.object({
      location: z.string(),
      description: z.string(),
      suitableFor: z.string(),
    }),
  ),
});

/** The structured scene analysis Model 1 produces, consumed by Models 2 & 3. */
export type SceneAnalysis = z.infer<typeof SceneResponse>;

export interface AnalyzeSceneInput {
  /** Input image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Input image mime (jpeg/png). */
  mimeType: ImageMime;
}

/**
 * A LIGHTWEIGHT scene brief for Model 2 (prompt enhancement) — just enough grounding
 * (space type, setting, style, lighting) to phrase the user's request naturally.
 * Deliberately omits the editable zones and the fixed-element list: Model 2 must not
 * decide what to add or where — that belongs to Model 3 — so it never sees placement
 * cues that tempt it into inventing products.
 */
export function renderSceneBrief(scene: SceneAnalysis): string {
  return [
    `Space: ${scene.spaceType} (${scene.setting}).`,
    `Landscape: ${scene.landscape}`,
    `Existing style: ${scene.style}.`,
    `Existing lighting: ${scene.lighting}.`,
  ].join(' ');
}

export const analyzeSceneStep: PipelineStep<AnalyzeSceneInput, SceneAnalysis> = {
  name: 'analyzeScene',
  async run({ image, mimeType }) {
    const raw = await generateFromImage({
      image,
      mimeType,
      prompt: 'Analyze this space and return the structured scene description.',
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: SCENE_SCHEMA,
      model: config.gemini.model1,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Scene analysis returned invalid JSON');
    }
    const scene = SceneResponse.parse(parsed);

    // Drop blank zones, then fail-fast if none survive (nothing to add into).
    scene.editableZones = scene.editableZones.filter(
      (z) => z.location.trim() && z.suitableFor.trim(),
    );
    if (scene.editableZones.length === 0) {
      throw new Error('Scene analysis found no editable zones');
    }
    return scene;
  },
};
