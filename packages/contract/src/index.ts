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
 *   - 2026-07-08 — Gardens-only + style picker: CreateJobRequest gains `style` (server-catalog
 *                  id, validated API-side) and `prompt` becomes optional. Style ids live in a
 *                  hand-editable server manifest (GET /styles), deliberately NOT enumerated here.
 *   - 2026-07-10 — Model 4 grouping + price: Product gains optional priceMin/priceMax (INR,
 *                  AI-estimated approximate range). JobResult.products (flat) → productGroups
 *                  (AI-generated groups, single-pass). ProductGroup added.
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
  // Garden style id from the server catalog (GET /styles). The concrete id set is
  // server-driven (hand-editable manifest), so the contract only requires a non-empty
  // string here; the API validates it against the live catalog and 400s if unknown.
  style: z.string().min(1, 'style is required'),
  // Optional free-text request layered on top of the style (e.g. "add a water feature").
  prompt: z.string().max(2000, 'prompt must be at most 2000 characters').optional(),
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
  // Approximate price range (INR), AI-estimated by Model 4 — general, not exact.
  // Optional: other producers of Product (e.g. the /showcase manifest) omit them.
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
});
export type Product = z.infer<typeof Product>;

// A group of shoppable products under one AI-generated category label (e.g.
// "Lighting", "Plants & Greenery"). Model 4 emits the groups in a single pass, so
// each label is coherent (no near-duplicate "Lights" vs "Lighting" buckets).
export const ProductGroup = z.object({
  group: z.string(),
  items: z.array(Product),
});
export type ProductGroup = z.infer<typeof ProductGroup>;

export const JobResult = z.object({
  outputImage: z.string(), // base64 (no data-uri prefix)
  mimeType: OutputImageMime, // edited image's real content-type (may be webp)
  productGroups: z.array(ProductGroup),
});
export type JobResult = z.infer<typeof JobResult>;

export const GetJobResponse = z.object({
  jobId: z.string(),
  status: JobStatus,
  result: JobResult.nullable(),
  error: z.string().nullable(),
});
export type GetJobResponse = z.infer<typeof GetJobResponse>;
