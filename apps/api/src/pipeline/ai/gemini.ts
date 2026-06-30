import { GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';

/**
 * Shared Gemini client + helper for the pipeline (used by Model 1 prompt
 * enhancement now; Model 3 vision later). Keys/model/timeout come from env via
 * `config.gemini`.
 */

let client: GoogleGenAI | undefined;

/** Lazy singleton. Fail-fast if the API key is missing (clear config error). */
function getGemini(): GoogleGenAI {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

export interface GenerateTextArgs {
  /** User-facing content for this turn. */
  prompt: string;
  /** System instruction steering the model's behaviour. */
  systemInstruction: string;
}

/**
 * Single-turn text generation with a hard timeout (`config.gemini.timeoutMs`)
 * enforced via AbortController. Returns the trimmed text, or throws if the
 * model returned nothing.
 */
export async function generateText({ prompt, systemInstruction }: GenerateTextArgs): Promise<string> {
  const ai = getGemini();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gemini.timeoutMs);
  try {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
      config: { systemInstruction, abortSignal: controller.signal },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
