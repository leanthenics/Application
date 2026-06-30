import Replicate, { type FileOutput } from 'replicate';
import { OutputImageMime } from '@clickretina/contract';
import { config } from '../../config.js';
import { withRetry } from './retry.js';

/**
 * Shared Replicate client + helper for the pipeline (Model 2 — Qwen Image 2.0
 * image edit). Token/model/timeout come from env via `config.replicate`.
 */

let client: Replicate | undefined;

/** Lazy singleton. Fail-fast if token or model id is missing (clear config error). */
function getReplicate(): Replicate {
  if (!config.replicate.apiToken) {
    throw new Error('REPLICATE_API_TOKEN is not set');
  }
  if (!config.replicate.model) {
    throw new Error('REPLICATE_MODEL is not set');
  }
  if (!client) {
    client = new Replicate({ auth: config.replicate.apiToken });
  }
  return client;
}

export interface EditImageArgs {
  /** Input image as a data URI (`data:<mime>;base64,<bytes>`). */
  dataUri: string;
  /** The (already Gemini-enhanced) edit instruction. */
  prompt: string;
  /** Mime to fall back to if Replicate's content-type is missing/unsupported. */
  fallbackMime: OutputImageMime;
}

export interface EditImageResult {
  /** Edited image bytes, base64-encoded (no data-uri prefix). */
  base64: string;
  /** Edited image's content-type, validated against the output contract. */
  mimeType: OutputImageMime;
}

/** Narrow the unknown `replicate.run` output to a single FileOutput or URL string. */
function firstOutput(out: unknown): FileOutput | string {
  const candidate = Array.isArray(out) ? out[0] : out;
  if (!candidate) {
    throw new Error('Replicate returned no image');
  }
  return candidate as FileOutput | string;
}

/**
 * Map Replicate's raw content-type (e.g. `image/webp`, possibly with params) onto
 * the output contract. Anything outside the allowed set falls back to the input
 * mime, so the returned value is always a valid `OutputImageMime`.
 */
function resolveMime(raw: string | undefined, fallback: OutputImageMime): OutputImageMime {
  const bare = raw?.split(';')[0]?.trim();
  const parsed = OutputImageMime.safeParse(bare);
  return parsed.success ? parsed.data : fallback;
}

/**
 * Run the Qwen image edit with a hard timeout (`config.replicate.timeoutMs`)
 * enforced via AbortController. Returns the edited image as base64 + its real
 * content-type. `replicate.run` polls the prediction internally and rejects if
 * it ends in a failed state.
 *
 * `match_input_image: true` keeps the (already client-resized) room's aspect
 * ratio/resolution; `enable_prompt_expansion: false` uses our enhanced prompt
 * verbatim instead of letting Qwen rewrite it a second time.
 */
export async function editImage({ dataUri, prompt, fallbackMime }: EditImageArgs): Promise<EditImageResult> {
  const replicate = getReplicate();
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.replicate.timeoutMs);
    try {
      const out = await replicate.run(
        config.replicate.model as `${string}/${string}`,
        {
          input: {
            image: dataUri,
            prompt,
            match_input_image: true,
            enable_prompt_expansion: false,
          },
          signal: controller.signal,
        },
      );

      const first = firstOutput(out);

      // Default SDK behaviour: FileOutput (a ReadableStream with `.blob()`).
      // Fallback: a plain URL string when `useFileOutput` is disabled.
      let rawMime: string | undefined;
      let base64: string;
      if (typeof first === 'string') {
        const resp = await fetch(first, { signal: controller.signal });
        rawMime = resp.headers.get('content-type') ?? undefined;
        base64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
      } else {
        const blob = await first.blob();
        rawMime = blob.type || undefined;
        base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
      }

      if (!base64) {
        throw new Error('Replicate returned an empty image');
      }
      return { base64, mimeType: resolveMime(rawMime, fallbackMime) };
    } finally {
      clearTimeout(timer);
    }
  }, { ...config.ai.retry, label: 'replicate.editImage' });
}
