# ClickRetina — Architecture

> Status: **B1 complete & verified on Upstash Redis**; next is **B2 (real AI pipeline)**. Full lifecycle
> works: `POST /jobs` → BullMQ worker → `GET /jobs/:id` returns a contract-typed `JobResult` (currently a
> clearly-marked **template** stub — B2 fills real data into the same shape). The §6 contract is now
> codified in `packages/contract` (ImageMime, CreateJob*, JobStatus, Product, JobResult, GetJobResponse;
> only ApiError + constants deferred) and must stay stable as the stub → real pipeline.
> Dev Redis = Upstash cloud (`rediss://`). Last updated: 2026-06-30

## 1. Product summary

ClickRetina is a mobile app. A user submits an **image of a room/space + a text prompt**.
The backend runs a 3-model AI pipeline that returns an **edited image** (restyled/edited
furniture & products) plus **Amazon affiliate search links** for each detected product, so the
user can shop the look.

## 2. Tech stack

| Layer        | Choice                                                              |
|--------------|--------------------------------------------------------------------|
| Frontend     | React Native (Expo) + TypeScript                                   |
| Backend      | Node.js + Express + TypeScript                                     |
| Queue        | BullMQ (Redis-backed)                                              |
| Shared types | Zod schemas in `packages/contract` — single source of truth for the API |
| AI – Model 1 | Gemini Flash-Lite — prompt enhancement (text → text)              |
| AI – Model 2 | Qwen Image 2.0 via **Replicate** — image edit (image + prompt → image) |
| AI – Model 3 | Gemini Flash-Lite (vision) — product key-term extraction (image → terms) |

> Exact model IDs/versions are env-configurable (`GEMINI_MODEL`, `REPLICATE_MODEL`). Pin exact
> versions at implementation time.

## 3. Monorepo layout (pnpm workspaces)

```
ClickRetina/
├─ package.json              # workspace root, scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ apps/
│  ├─ api/                   # Express + BullMQ (server + worker)
│  └─ mobile/                # Expo React Native app
└─ packages/
   └─ contract/              # Zod schemas + inferred TS types (imported by api & mobile)
```

## 4. End-to-end workflow

```
App ──(image[base64,768px] + prompt)──> POST /jobs
API  ── zod-validate ── enqueue BullMQ job ── 202 { jobId }   (returns immediately)
        │
   BullMQ Worker (fail-fast, no retries):
   ├─ Model 1  Gemini Flash-Lite      : prompt                  -> enhancedPrompt
   ├─ Model 2  Qwen 2.0 (Replicate)   : inputImage + enhancedPrompt -> editedImage
   ├─ Model 3  Gemini Flash-Lite (vis): editedImage             -> [keyterms] (max 5)
   └─ Amazon link builder             : keyterm -> affiliate search URL (one per product)
        │
   Job result: { outputImage[base64], products: [{ keyterm, amazonUrl }] }
        │
App ──(poll)──> GET /jobs/:id ── { status, result?, error? }
```

## 5. Decisions locked (2026-06-29)

1. **Result delivery:** client **polls** `GET /jobs/:id` until `status` is `completed`/`failed`.
2. **Image transport:** **base64** in JSON. Client **resizes to 768px (JPEG)** before encoding.
   API enforces a **max body size (~10MB default)**. No object storage in phase 1.
   - Tradeoff: base64 in Redis is heavier; acceptable at 768px (~200–500KB). Revisit S3/R2 later.
3. **Persistence:** **Redis only** via BullMQ. No DB, **no auth**, anonymous. Job + result live in
   Redis with a TTL (default: completed/failed jobs kept **~10 min** / `JOB_TTL_SECONDS=600`, then evicted).
4. **Failure handling:** **fail-fast, no retries.** Any model error → job `failed` with an error
   message the client can display.
5. **Amazon links:** **one affiliate search URL per detected product**, returned as a list.
   - URL: `https://www.amazon.<AMAZON_TLD>/s?k=<urlencoded keyterm>&tag=<AMAZON_AFFILIATE_TAG>`
   - `AMAZON_TLD` + `AMAZON_AFFILIATE_TAG` from **env** (default tld: `in`). No PA-API in phase 1.
6. **Product cap:** Model 3 returns at most **5** key terms (most prominent items).
7. **Repo:** **pnpm workspaces monorepo** (`apps/api`, `apps/mobile`, `packages/contract`).

## 6. API contract (`packages/contract`, Zod)

Single source of truth, imported by both API and mobile. Shapes (to be implemented as zod):

```ts
// Enums
JobStatus = 'queued' | 'processing' | 'completed' | 'failed'
ImageMime = 'image/jpeg' | 'image/png'

// POST /jobs  (create job)
CreateJobRequest  = { image: string /*base64, no data-uri prefix*/,
                      mimeType: ImageMime /*default image/jpeg*/,
                      prompt: string /*1..2000 chars*/ }
CreateJobResponse = { jobId: string }

// GET /jobs/:id  (poll)
Product       = { keyterm: string, amazonUrl: string /*url*/ }
JobResult     = { outputImage: string /*base64*/, mimeType: ImageMime, products: Product[] }
GetJobResponse= { jobId: string, status: JobStatus,
                  result: JobResult | null, error: string | null }

// Errors (all endpoints)
ApiError = { error: { code: string, message: string } }
```

Internal (not part of the public contract, lives in api):
```ts
JobData     = { image: string, mimeType: ImageMime, prompt: string }   // enqueued payload
PipelineOut = { outputImage: string, mimeType: ImageMime, products: Product[] }
```

### Endpoints

| Method | Path         | Body / Params         | Success           | Notes                         |
|--------|--------------|-----------------------|-------------------|-------------------------------|
| POST   | `/jobs`      | `CreateJobRequest`    | `202` `CreateJobResponse` | validate, enqueue, return jobId |
| GET    | `/jobs/:id`  | `id` path param       | `200` `GetJobResponse`    | maps BullMQ state → JobStatus |
| GET    | `/health`    | —                     | `200`             | liveness + redis ping         |

BullMQ state → `JobStatus` mapping: `waiting/delayed` → `queued`, `active` → `processing`,
`completed` → `completed`, `failed` → `failed`.

## 7. Configuration (env)

| Var                     | Purpose                                   |
|-------------------------|-------------------------------------------|
| `PORT`                  | API port                                  |
| `REDIS_URL`             | Redis connection for BullMQ               |
| `MAX_BODY_SIZE`         | Express body limit (default ~10mb)        |
| `GEMINI_API_KEY`        | Gemini (models 1 & 3)                      |
| `GEMINI_MODEL`          | Gemini model id                           |
| `REPLICATE_API_TOKEN`   | Replicate auth (model 2)                   |
| `REPLICATE_MODEL`       | Qwen image model id/version               |
| `AMAZON_TLD`            | Amazon domain suffix (default `in`)       |
| `AMAZON_AFFILIATE_TAG`  | Affiliate tag appended to search URLs     |
| `JOB_TTL_SECONDS`       | Redis retention for finished jobs (default `600` = 10 min) |

## 8. Out of scope (phase 1)

Auth/accounts, object storage, payments, push notifications, persistent history/DB, rate limiting
beyond body-size cap, PA-API real product matching, web client.
