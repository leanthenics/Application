import 'dotenv/config';

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
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 30000),
  },
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN ?? '',
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
