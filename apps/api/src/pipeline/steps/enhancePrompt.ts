import type { PipelineStep } from '../step.js';
import { config } from '../../config.js';
import { generateText } from '../ai/gemini.js';
import { renderSceneBrief, type SceneAnalysis } from './analyzeScene.js';

/**
 * Model 2 — Gemini Flash prompt enhancement (text → text).
 *
 * STYLE-DRIVEN prompt enhancer for a garden redesign. It takes the chosen garden
 * STYLE (from the catalog) plus the user's OPTIONAL free-text request and a light
 * scene brief, and writes one concise, render-friendly instruction describing the
 * desired garden in that style. The style is the aesthetic frame; the optional user
 * text layers specific asks ("add a water feature") on top. It does NOT list specific
 * products, counts, or placements — that stays with Model 3 (nano invents the pieces
 * and preserves the scene). It stays strictly within the garden theme + chosen style.
 *
 * Non-fatal: enhancement is a nice-to-have. If Model 2 is disabled or errors
 * (transient exhaustion, timeout, empty) we FALL BACK to a style-based base
 * instruction (style guidance + any user text) rather than failing the job.
 */

const SYSTEM_INSTRUCTION = `You write ONE clear, render-friendly instruction for an AI image model that will redesign an outdoor space / garden in a chosen STYLE. You are given the style (its aesthetic), an optional extra request from the user, and a brief of the real space. You are shaping the request, not choosing specific products.

Strict rules:
- The chosen garden style is the aesthetic frame — describe the desired garden in that style (its mood, materials, palette, planting character). If there is an extra user request, weave it in faithfully. If there is no extra request, the style alone drives the instruction.
- Stay entirely within a GARDEN / outdoor-planting theme and the chosen style. Do NOT drift into unrelated indoor themes, and do NOT introduce anything the style and request don't imply.
- Do NOT invent or list specific products, brands, item counts, or exact placements. Describe the look, feel, and character — let the image model choose the specific plants and features.
- Use the space brief only to stay consistent with the real place (its surroundings, light, existing character). Do not describe or restate what is already in the photo, and do not mention preserving anything.
- Write 1–3 short sentences of plain prose. No lists, no markdown, no preamble, no mention of "the user". Output ONLY the instruction.`;

/** Cap on the enhanced request length (defensive; the model writes 1–3 short sentences). */
const MAX_ENHANCED_LENGTH = 600;

export interface EnhancePromptInput {
  /** Chosen garden style label (from the catalog). */
  styleLabel: string;
  /** Rich style description (from the catalog) — the aesthetic to render. */
  styleGuidance: string;
  /** Optional free-text request layered on top of the style. */
  prompt?: string;
  /** Model 1's structured scene analysis (only a light brief is used for grounding). */
  scene: SceneAnalysis;
}

/**
 * Style-based instruction used verbatim when Model 2 is disabled or fails — always a
 * usable, non-empty instruction for Model 3 even without a live enhancement.
 */
function baseInstruction(styleLabel: string, styleGuidance: string, prompt?: string): string {
  const extra = prompt?.trim() ? ` Also incorporate: ${prompt.trim()}.` : '';
  return `Redesign this space as a ${styleLabel} garden. ${styleGuidance}${extra}`.trim();
}

export const enhancePromptStep: PipelineStep<EnhancePromptInput, string> = {
  name: 'enhancePrompt',
  async run({ styleLabel, styleGuidance, prompt, scene }) {
    // Toggle: when Model 2 is disabled, skip the call and use the style base instruction.
    if (!config.gemini.model2Enabled) {
      console.log('[enhancePrompt] disabled (MODEL2_ENABLED=false); using the style base instruction');
      return baseInstruction(styleLabel, styleGuidance, prompt);
    }

    const userTurn = [
      `Garden style: ${styleLabel}`,
      `Style description: ${styleGuidance}`,
      prompt?.trim() ? `Extra user request: ${prompt.trim()}` : 'No extra user request.',
      '',
      `Space (for consistency only): ${renderSceneBrief(scene)}`,
      '',
      `Write the single garden-redesign instruction now, in the ${styleLabel} style${
        prompt?.trim() ? ', incorporating the extra request' : ''
      }.`,
    ].join('\n');

    try {
      const enhanced = (
        await generateText({
          prompt: userTurn,
          systemInstruction: SYSTEM_INSTRUCTION,
          model: config.gemini.model2,
        })
      ).trim();
      if (enhanced) {
        return enhanced.slice(0, MAX_ENHANCED_LENGTH);
      }
      console.warn('[enhancePrompt] empty enhancement; falling back to the style base instruction');
    } catch (err) {
      // Enhancement is optional — don't fail the job; use the style base instead.
      console.warn(
        `[enhancePrompt] enhancement failed (${err instanceof Error ? err.message : String(err)}); falling back to the style base instruction`,
      );
    }
    return baseInstruction(styleLabel, styleGuidance, prompt);
  },
};
