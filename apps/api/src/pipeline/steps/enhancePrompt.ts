import type { PipelineStep } from '../step.js';
import { generateText } from '../ai/gemini.js';

/**
 * Model 1 — Gemini Flash-Lite prompt enhancement (text → text).
 *
 * Turns the user's short request into a vivid, concrete edit instruction for the
 * downstream image-editing model (Model 2). Output is the rewritten prompt only.
 */

const SYSTEM_INSTRUCTION = [
  'You are a prompt engineer for an AI interior/furniture image-editing model.',
  "Rewrite the user's short request into a single, vivid, concrete editing instruction.",
  'Be specific about furniture, materials, colors, lighting, and layout while staying',
  "faithful to the user's intent and the existing room. Preserve the room's structure",
  '(walls, windows, perspective) unless the user asks to change it.',
  'Output ONLY the rewritten instruction as plain text — no preamble, quotes, or lists.',
].join(' ');

/** Reasonable upper bound so a runaway response never bloats the downstream call. */
const MAX_ENHANCED_LENGTH = 1200;

export const enhancePromptStep: PipelineStep<string, string> = {
  name: 'enhancePrompt',
  async run(userPrompt) {
    const enhanced = await generateText({
      prompt: userPrompt,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    // `generateText` already throws on empty; guard again defensively.
    if (!enhanced) {
      throw new Error('Prompt enhancement produced no output');
    }
    return enhanced.slice(0, MAX_ENHANCED_LENGTH);
  },
};
