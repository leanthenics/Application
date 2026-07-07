import 'dotenv/config';

/**
 * Which Replicate image-edit model family Model 2 talks to. Selects the input
 * param shape in `pipeline/ai/replicate.ts` — switching is a pure env swap
 * (`REPLICATE_PROVIDER` + `REPLICATE_MODEL`), no code change.
 */
export type ReplicateProvider = 'qwen' | 'kontext' | 'nano';

/**
 * Central runtime config. Reads from env with sensible defaults.
 * Required-on-boot validation is added in B3 (config validation).
 */
export const config = {
  port: Number(process.env.PORT ?? 54321),
  maxBodySize: process.env.MAX_BODY_SIZE ?? '10mb',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jobTtlSeconds: Number(process.env.JOB_TTL_SECONDS ?? 600),
  amazon: {
    tld: process.env.AMAZON_TLD ?? 'in',
    affiliateTag: process.env.AMAZON_AFFILIATE_TAG ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    // Default model for Gemini calls (Model 3 key-term extraction uses this).
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
    // Model 1 (prompt/plan) runs on the stronger Flash model for better instruction-following.
    model1: process.env.GEMINI_MODEL_1 ?? 'gemini-2.5-flash',
    // Item-count range for Model 1's plan. Env-tunable so we can sweep for the
    // quantity-vs-preservation sweet spot without code edits — change these + restart worker.
    model1MinItems: Number(process.env.MODEL1_MIN_ITEMS ?? 12),
    model1MaxItems: Number(process.env.MODEL1_MAX_ITEMS ?? 16),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 30000),
  },
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN ?? '',
    // 'qwen' (default), 'kontext', or 'nano' — picks the input param shape for Model 2.
    provider: (process.env.REPLICATE_PROVIDER ?? 'qwen') as ReplicateProvider,
    model: process.env.REPLICATE_MODEL ?? '',
    timeoutMs: Number(process.env.REPLICATE_TIMEOUT_MS ?? 120000),
  },
  ai: {
    // Per-call transient-retry (429/503) for model calls. maxAttempts = total tries.
    retry: {
      maxAttempts: Number(process.env.AI_MAX_RETRIES ?? 3),
      baseDelayMs: Number(process.env.AI_RETRY_BASE_MS ?? 500),
    },
  },
} as const;
