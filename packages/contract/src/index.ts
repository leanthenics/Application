import { z } from 'zod';

/**
 * @clickretina/contract — shared Zod schemas + inferred types.
 *
 * Single source of truth for request/response shapes, imported by `apps/api`
 * (and `apps/mobile` later) via workspace link.
 *
 * Policy (deliberate): a schema/constant is promoted here only AFTER its
 * endpoint has been built and manually verified (Postman).
 *
 * Promoted so far:
 *   - 2026-06-30 — POST /jobs verified → ImageMime, CreateJobRequest, CreateJobResponse.
 *   - 2026-06-30 — GET /jobs/:id verified + result shape finalized (B1.4 stub) →
 *                  JobStatus, Product, JobResult, GetJobResponse.
 *     (B2 fills real data into JobResult; the SHAPE is stable, so it's safe to promote now.)
 *   - 2026-06-30 — B2.2 (Model 2 wired): added OutputImageMime (jpeg/png/webp) for
 *                  JobResult.mimeType, since Qwen returns its native format (webp). Input
 *                  ImageMime stays strict (jpeg/png). Additive widening of the output set.
 *
 * Still pending (added when required):
 *   schemas: ApiError
 *   constants: prompt max length, product cap (5), max body size, JOB_TTL_SECONDS
 */

// ── Shared enums ────────────────────────────────────────────────────────────
// Input is constrained to what the client uploads (resized JPEG; PNG allowed).
export const ImageMime = z.enum(['image/jpeg', 'image/png']);
export type ImageMime = z.infer<typeof ImageMime>;

// Output may differ from input: Model 2 (Qwen Image 2.0) returns its native
// format (commonly WebP). `JobResult.mimeType` reports the edited image's real
// content-type, so the output set is wider than the input set.
export const OutputImageMime = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export type OutputImageMime = z.infer<typeof OutputImageMime>;

// ── POST /jobs ──────────────────────────────────────────────────────────────
// base64 (no data-uri prefix): standard charset, optional `=` padding, length a multiple of 4.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export const CreateJobRequest = z.strictObject({
  image: z
    .string()
    .min(1, 'image is required')
    .refine((s) => s.length % 4 === 0 && BASE64_RE.test(s), 'image must be valid base64'),
  mimeType: ImageMime.default('image/jpeg'),
  prompt: z.string().min(1, 'prompt is required').max(2000, 'prompt must be at most 2000 characters'),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequest>;

export const CreateJobResponse = z.object({
  jobId: z.string(),
});
export type CreateJobResponse = z.infer<typeof CreateJobResponse>;

// ── GET /jobs/:id ───────────────────────────────────────────────────────────
export const JobStatus = z.enum(['queued', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatus>;

export const Product = z.object({
  keyterm: z.string(),
  amazonUrl: z.url(),
});
export type Product = z.infer<typeof Product>;

export const JobResult = z.object({
  outputImage: z.string(), // base64 (no data-uri prefix)
  mimeType: OutputImageMime, // edited image's real content-type (may be webp)
  products: z.array(Product),
});
export type JobResult = z.infer<typeof JobResult>;

export const GetJobResponse = z.object({
  jobId: z.string(),
  status: JobStatus,
  result: JobResult.nullable(),
  error: z.string().nullable(),
});
export type GetJobResponse = z.infer<typeof GetJobResponse>;
