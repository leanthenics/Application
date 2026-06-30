import { GoogleGenAI, type Schema } from '@google/genai';
import { config } from '../../config.js';
import { withRetry } from './retry.js';

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
  return withRetry(async () => {
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
  }, { ...config.ai.retry, label: 'gemini.generateText' });
}

export interface GenerateFromImageArgs {
  /** Image bytes, base64 (no data-uri prefix). */
  image: string;
  /** Image content-type (e.g. image/png, image/webp). */
  mimeType: string;
  /** User-facing instruction for this turn. */
  prompt: string;
  /** System instruction steering the model. */
  systemInstruction: string;
  /** Structured-output schema; the response is JSON matching it. */
  responseSchema: Schema;
}

/**
 * Single-turn multimodal generation (image + text) with structured JSON output
 * and the same hard timeout as `generateText`. Returns the trimmed response text
 * (a JSON string per `responseSchema`), or throws if the model returned nothing.
 */
export async function generateFromImage({
  image,
  mimeType,
  prompt,
  systemInstruction,
  responseSchema,
}: GenerateFromImageArgs): Promise<string> {
  const ai = getGemini();
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.gemini.timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model: config.gemini.model,
        contents: [{ parts: [{ inlineData: { mimeType, data: image } }, { text: prompt }] }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          abortSignal: controller.signal,
        },
      });
      const text = response.text?.trim();
      if (!text) {
        throw new Error('Gemini returned an empty response');
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }, { ...config.ai.retry, label: 'gemini.generateFromImage' });
}
