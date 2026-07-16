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
const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT ?? 54321),
  maxBodySize: process.env.MAX_BODY_SIZE ?? '10mb',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jobTtlSeconds: Number(process.env.JOB_TTL_SECONDS ?? 600),
  supabase: {
    url: supabaseUrl,
    // Public JWKS (asymmetric ES256 keys) used to verify user access tokens locally,
    // and the issuer every valid Supabase token must carry. Derived from SUPABASE_URL
    // so there's a single source of truth.
    jwksUrl: supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '',
    issuer: supabaseUrl ? `${supabaseUrl}/auth/v1` : '',
    // Service-role key — SERVER ONLY, bypasses RLS. Used by the credits DB client
    // to spend/refund/grant credits (the DB is the source of truth). Never expose
    // this to the mobile app; it lives only in apps/api/.env.
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  amazon: {
    tld: process.env.AMAZON_TLD ?? 'in',
    affiliateTag: process.env.AMAZON_AFFILIATE_TAG ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    // Default model for Gemini calls (Model 4 product extraction/grouping uses this).
    // On Flash (not Flash-Lite) for better grouping coherence + price estimation.
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    // Model 1 (scene analysis, vision) runs on the stronger Flash model for better scene understanding.
    model1: process.env.GEMINI_MODEL_1 ?? 'gemini-2.5-flash',
    // Model 2 (prompt enhancement, text) also on Flash for faithful instruction-following.
    model2: process.env.GEMINI_MODEL_2 ?? 'gemini-2.5-flash',
    // Toggle Model 2 (prompt enhancement) on/off. When off, the raw user prompt goes
    // straight to Model 3. Set MODEL2_ENABLED=false to disable. Default: enabled.
    model2Enabled: process.env.MODEL2_ENABLED !== 'false',
    // Design richness 0..1 (0 = minimal additions, 1 = fully furnished). Steers how many
    // fitting items Model 3 (nano) adds — nano invents the actual pieces. Env-tunable so we
    // can sweep fullness-vs-preservation without code edits — change + restart worker. Clamped
    // to [0,1]; a non-numeric value falls back to the 0.6 default rather than NaN.
    richness: (() => {
      const r = Number(process.env.DESIGN_RICHNESS ?? 0.6);
      return Number.isFinite(r) ? Math.min(Math.max(r, 0), 1) : 0.6;
    })(),
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
