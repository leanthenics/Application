# ClickRetina — Backend Tasks

> Full backend workflow, divided into sequential, checkable steps so we can design and verify one
> step at a time. See `architecture.md` for decisions/contract and `plan.md` for the roadmap.
> Frontend is out of scope for now.
>
> **Update this file as we go** — flip the box and add notes when a task is done.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done
**Current focus:** **B2 — real AI pipeline** (replace the B1.4 stub). B2.0 (scaffolding) + B2.1 (Model 1
prompt-enhance) + **B2.2 (Model 2 Replicate Qwen Image 2.0 edit) DONE & verified live (2026-06-30)**:
POST a real room photo → worker logged `enhancePrompt ok` → `editImage ok` → `completed`; GET returned a
**genuinely edited** image (not the input echo), `mimeType: image/png`. Models 3–4 still stubbed inside
`pipeline/runner.ts`. **Next: B2.3 — Gemini Flash-Lite vision key-term extraction** (replace the fixed
`STUB_KEYTERMS` in `runner.ts` with real terms read from the edited image).

> Note: package manager is **pnpm workspaces** (v11.9.0 via corepack).
> Env quirk: global `pnpm` shim installed into `%AppData%\npm` (npm prefix, on PATH) via
> `corepack enable --install-directory` because `C:\Program Files\nodejs` needs admin.
> Build scripts are gated by a supply-chain policy — approved deps live under `allowBuilds:`
> in `pnpm-workspace.yaml` (esbuild, msgpackr-extract, protobufjs, @google/genai).

---

## B0 — Monorepo & contract foundation

### B0.1 Workspace scaffold
- [x] Root `package.json` (private, scripts: `dev:api`/`build:api`/`start:api` via `pnpm --filter`).
- [x] `pnpm-workspace.yaml` declares packages (`apps/*`, `packages/*`).
- [x] `tsconfig.base.json` (strict, shared compiler options).
- [x] `.gitignore`. ( `.editorconfig` + ESLint/Prettier still TODO )
- [x] `.env.example` covering all vars from architecture.md §7.

### B0.2 Contract package (`packages/contract`)
> **Workflow policy (locked):** schemas/constants are promoted into the contract **only after**
> the matching endpoint is built and manually verified in Postman — endpoint first, contract
> second. We do **not** front-load shapes or constraints "beforehand"; each is added when required.
- [x] `package.json` (`@clickretina/contract`, build via tsc) + `tsconfig.json`. Scaffolded; ESM/NodeNext, emits declarations.
- [~] Zod schemas: ~~`ImageMime`, `CreateJobRequest`, `CreateJobResponse`~~ (POST /jobs),
      ~~`JobStatus`, `Product`, `JobResult`, `GetJobResponse`~~ (GET /jobs/:id + result shape) **all
      promoted 2026-06-30**. Only `ApiError` remains **deferred per policy** (add when a client needs it).
- [x] Export inferred TS types alongside each promoted schema. `apps/api` now consumes them
      (`status.ts`→`JobStatus`, `worker.ts`→`JobResult`, GET route→`GetJobResponse`).
- [ ] Constants: prompt max length, product cap (5), max body size default, `JOB_TTL_SECONDS` default 600. — **deferred per policy**, add when required.
- [x] Build the package; confirm it imports cleanly from `apps/api`. Built → `dist/`; `apps/api` imports
      `CreateJobRequest` from `@clickretina/contract`; local `apps/api/src/schemas/jobs.ts` deleted (single source).

---

## B1 — API + queue skeleton (stub worker)

### B1.1 API app bootstrap (`apps/api`)  — partially done
- [x] `package.json` + `tsconfig.json`. (depend on `@clickretina/contract` once B0.2 exists)
- [x] Express app entry; JSON body parser with `MAX_BODY_SIZE` limit.
- [~] Env loader (`config.ts` done; boot-time required-var validation deferred to B3.3).
- [x] `GET /health` (process up). (Redis ping added with B1.2)
- [x] 404 handler + central `ApiError` error handler done (maps `entity.too.large`→413,
      `entity.parse.failed`→400, fallback→500; envelope via `http/errors.ts` `apiError()`).

> Done so far: monorepo + `apps/api` Express + TS server running on **:54321**, libs installed
> (express, cors, dotenv, zod, bullmq, ioredis, @google/genai, replicate). `/health` verified.

### B1.2 Redis + BullMQ wiring  — **runtime-verified on Upstash cloud Redis (2026-06-30)**
- [x] Redis connection from `REDIS_URL` (ioredis) — `jobs/shared.ts` `createRedis()` (`maxRetriesPerRequest: null`).
- [x] BullMQ `Queue` instance (`jobs` queue) with finished-job TTL = `JOB_TTL_SECONDS` — `jobs/queue.ts`
      (`removeOnComplete/Fail: { age }`, `attempts: 1` = fail-fast).
- [x] BullMQ `Worker` bootstrap (separate entry/process), concurrency = 1 — `jobs/worker.ts`
      (stub processor: log + **7000ms** delay + placeholder `{ ok: true }`; real stub = B1.4). Scripts: `dev:worker`/`start:worker`.
- [x] Job state read helper — `jobs/status.ts` `mapState()` (BullMQ state → `JobStatus`).
- [~] Redis for dev = **Upstash cloud** (`rediss://default:…@…upstash.io:6379` in `apps/api/.env`; ioredis
      auto-TLS for `rediss://`). README dev note still TODO. ⚠️ Upstash gives a read-only `default_ro` user —
      must use full-access `default`.
- ⚠️ Dep note: pinned single `ioredis` 5.11.1 via `overrides:` in `pnpm-workspace.yaml` (BullMQ pulled 5.10.1 → type clash).
- ⚠️ `apps/api` tsconfig now `declaration: false` (it's an app, not a lib) to avoid TS portability annotations.

### B1.3 Endpoints
- [x] `POST /jobs`: validate `CreateJobRequest` → `jobsQueue.add('process', data, { jobId: uuid })`
      → `202 { jobId }`. (`routes/jobs.ts`; enqueue wired — needs Redis to exercise.)
- [x] Reject invalid body → `400 invalid_request`; malformed JSON → `400 invalid_json`;
      oversized → `413 payload_too_large`. **Validation paths verified in Postman 2026-06-30.**
- [x] `GET /jobs/:id`: `jobsQueue.getJob(id)` → 404 if missing/evicted; `mapState(getState())` →
      `JobStatus`; returns `{ jobId, status, result, error }` (`result` from `job.returnvalue` when
      completed, `error` from `job.failedReason` when failed). **Verified 2026-06-30** (POST → poll:
      processing… → completed; unknown id → 404). Response typed by `GetJobResponse` from the contract.

### B1.4 Stub worker (mock pipeline)  — **template done & verified (2026-06-30)**
- [x] Processor reads `JobData`, simulates work (7000ms delay).
- [x] Returns **template** mock `JobResult`: echoes input image as `outputImage`, 3 fake products with
      well-formed Amazon affiliate URLs. `worker.ts` `buildStubResult()` (clearly marked TEMPLATE/STUB,
      `TODO(B2)`). Returned shape is contract-typed (`JobResult`). Verified via GET (3 products, echoed image).
- [ ] On thrown error → job `failed` with message (validates fail path). — not yet exercised; do in B2/B3.
- [ ] Finished-job result honoured by TTL. — TTL configured (`age: JOB_TTL_SECONDS`); not explicitly tested.
- ℹ️ `AMAZON_AFFILIATE_TAG` is empty in `.env` → URLs end `&tag=`. Set it when ready.

### B1.5 Verify lifecycle
- [x] Manual: `POST /jobs` → jobId; poll `GET /jobs/:id` shows `queued → processing → completed`.
      **Verified in Postman (2026-06-30)** against the real B2.2 pipeline.
- [x] Manual: force error path → job ends `failed` with message. **Verified** — a transient Gemini 503
      (`UNAVAILABLE`) in the enhancePrompt step surfaced as `failed` + message via `GET` (fail-fast worked).
- [ ] README quickstart (install, env, run Redis, run api + worker, sample curl). — see `apps/api/VERIFY.md`
      for the manual checklist; README still TODO.

---

## B2 — Real AI pipeline (replace the stub, one model at a time)

### B2.0 Pipeline scaffolding — **coded & build-clean (2026-06-30)**
- [x] `pipeline/` module with a typed step interface (`input → output`) and ordered runner.
      `pipeline/step.ts` (`PipelineStep<In,Out>` + `runStep()` timing/log wrapper, fail-fast rethrow),
      `pipeline/context.ts` (`PipelineContext { jobId }`), `pipeline/runner.ts` (`runPipeline` — explicit
      ordered composition; step 1 real, steps 2–4 stubbed in-runner w/ `TODO(B2.2–B2.4)`).
- [x] Per-step structured logging (step name, duration, jobId) — no image payloads in logs.
      `[pipeline] <jobId> <name> ok (<ms>ms)` / `… failed (<ms>ms): <msg>`.
- [x] Shared AI client config (API keys, model ids, timeouts) from env. `pipeline/ai/gemini.ts`
      (lazy `GoogleGenAI` singleton, throws if key missing; `generateText()` with `AbortController`
      hard timeout). `config.ts`: `gemini.model` default pinned `gemini-2.5-flash-lite`, added
      `gemini.timeoutMs` (`GEMINI_TIMEOUT_MS`, 30000). `.env.example` updated.

### B2.1 Model 1 — Gemini Flash-Lite (prompt enhancement) — **DONE & verified live (2026-06-30)**
- [x] Gemini client + `enhancePrompt(userPrompt) → enhancedPrompt`. `pipeline/steps/enhancePrompt.ts`
      (`PipelineStep<string,string>`), via shared `generateText()`.
- [x] Enhancement system prompt (interior/furniture editing context). Output-only rewrite, preserve room structure.
- [x] Guard: empty/garbage response → throw (fail-fast). Empty checked in both `generateText()` and the step;
      output clamped to 1200 chars.
- [ ] Unit test with a mocked Gemini response. — **deferred** (user: manual endpoint testing first; decide on
      test runner after). Worker now calls `runPipeline`; stub helpers removed from `worker.ts`.

### B2.2 Model 2 — Replicate Qwen Image 2.0 (image edit) — **DONE & verified live (2026-06-30)**
- [x] Replicate client + `editImage({ dataUri, prompt, fallbackMime }) → { base64, mimeType }`.
      `pipeline/ai/replicate.ts` (lazy `Replicate` singleton, throws if token/model missing).
- [x] Feed input as **data-uri** (`data:<mime>;base64,<bytes>`); `replicate.run(model, { input })`;
      fetch output → base64. Qwen params: `match_input_image:true`, `enable_prompt_expansion:false`.
- [x] Async states + timeout: `replicate.run` polls the prediction internally (rejects on `failed`);
      hard cap via `AbortController` = `config.replicate.timeoutMs` (`REPLICATE_TIMEOUT_MS`, default 120000).
- [x] Guard: empty/missing output → throw (`firstOutput()` + empty-base64 check).
- [x] Output mime: read Replicate's real content-type, validate via `OutputImageMime` (else fall back
      to input mime). **Contract widened**: added `OutputImageMime` (jpeg/png/webp) for `JobResult.mimeType`;
      input `ImageMime` stays strict (jpeg/png). Wired step into `runner.ts` (echo stub removed).
- [ ] Unit test with mocked Replicate client. — **deferred** (manual verification first, per standing decision).

### B2.3 Model 3 — Gemini Flash-Lite vision (key-term extraction)
- [ ] `extractKeyterms(editedImage) → string[]` (max 5, most prominent furniture).
- [ ] Vision prompt returns clean, search-ready terms (e.g. "outdoor modern white sofa").
- [ ] Normalise/dedupe/trim; enforce cap of 5.
- [ ] Guard: empty list handling (define behaviour — succeed with [] vs fail).
- [ ] Unit test with mocked vision response.

### B2.4 Amazon affiliate URL builder
- [ ] `buildAmazonUrl(keyterm) → url` using `AMAZON_TLD` + `AMAZON_AFFILIATE_TAG`.
- [ ] URL-encode keyterm; map each keyterm → `Product { keyterm, amazonUrl }`.
- [ ] Unit test for encoding + tag/tld composition.

### B2.5 Wire pipeline into worker
- [ ] Replace stub: Model 1 → 2 → 3 → URL builder, producing `PipelineOut`.
- [ ] Fail-fast: any step throws → job `failed` with a client-safe message.
- [ ] End-to-end manual run with a real sample image → completed result.

---

## B3 — Hardening

### B3.1 Validation & limits
- [ ] Strict body validation (reject extra fields), mime allow-list, base64 sanity check.
- [ ] Enforce/verify body-size rejection (413) and prompt length bounds.

### B3.2 Reliability & lifecycle
- [ ] Confirm finished-job TTL (10 min) eviction works; `GET` of evicted id → 404/expired.
- [ ] Worker crash safety (one bad job doesn't take down the worker).
- [ ] Graceful shutdown (drain/close queue, Redis, worker).

### B3.3 Observability & config
- [ ] Structured logging + request IDs; redact image payloads.
- [ ] Boot-time config validation (fail clearly if required env missing).
- [ ] `/health` reflects Redis connectivity.

### B3.4 Tests
- [ ] Contract schema tests (valid/invalid payloads).
- [ ] Endpoint tests: happy path, validation failure, unknown id, failed job.
- [ ] Pipeline unit tests aggregated (models mocked) + URL builder.

---

## Definition of done (backend MVP)
- pnpm monorepo installs; `packages/contract` is the single source of truth.
- Full lifecycle works via polling against the **real** 3-model pipeline.
- Fail-fast errors surface as `failed` + message; finished jobs evict after 10 min.
- Contract/endpoints unchanged between stub (B1) and real pipeline (B2).

---

## Session log

### 2026-06-29
- Planning done: `architecture.md`, `plan.md`, `task.md` created; all phase-1 decisions locked.
- B0.1 done: monorepo scaffold (root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `.gitignore`, `.env.example`).
- B1.1 mostly done: `apps/api` Express + TS server with `/health` + 404 + `config.ts`,
  body-size limit. **Running on http://localhost:54321** (verified via `/health`).
- Installed all backend libs (express, cors, dotenv, zod, bullmq, ioredis, @google/genai, replicate
  + dev: typescript, tsx, @types/*).
- Migrated **npm → pnpm** (v11.9.0 via corepack). Shim in `%AppData%\npm`; build scripts approved
  under `allowBuilds:` in `pnpm-workspace.yaml`.

**▶ Resume next session at: B0.2** — build `packages/contract` (shared Zod schemas), then wire
`apps/api` to import it. After that, B1.2 needs a local **Redis** running.

### 2026-06-30
- B0.2 scaffold done: `packages/contract` created (`@clickretina/contract`, ESM/NodeNext, tsc build
  emitting declarations). `apps/api` now depends on it via `workspace:*`; `pnpm install` links all
  3 workspaces; contract builds to `dist/`; runtime import from `apps/api` verified (RESOLVED).
- **Contract workflow locked (user directive):** endpoint-first, contract-second. A schema/constant
  is promoted into `packages/contract` only **after** its endpoint is built and manually verified in
  Postman. No speculative shapes or constraints "beforehand". `src/index.ts` left intentionally empty
  (`export {}`) with the planned surface documented as a comment.

**▶ Resume next session at: B1.2** — Redis + BullMQ wiring (needs a local **Redis** running), then
B1.3 `POST /jobs`. First schema (`CreateJobRequest`) gets promoted into the contract *after* you
verify the endpoint in Postman.

### 2026-06-30 (cont.)
- B1.1 finished: central `ApiError` error handler added (`http/errors.ts` `apiError()`); body-parser
  failures → 413/400 envelopes.
- **B1.3 `POST /jobs` built & verified in Postman**: full Zod validation (strict, base64 refine,
  prompt 1..2000, mimeType enum), `202 { jobId: uuid }`. Error paths confirmed (400 invalid_request /
  invalid_json, 404 not_found).
- **B0.2 promotion**: `ImageMime`/`CreateJobRequest`/`CreateJobResponse` moved into `packages/contract`
  per the locked workflow; `apps/api` imports from it; local schema file deleted.
- **B1.2 BullMQ coded**: `jobs/shared.ts` (`createRedis`, `JobData`, queue name), `jobs/queue.ts`
  (producer, TTL eviction, `attempts:1`), `jobs/worker.ts` (separate process, concurrency 1, stub
  processor). POST /jobs now enqueues. `dev:worker`/`start:worker` scripts added. **Builds clean.**
- Dep fix: single `ioredis` 5.11.1 via `overrides:` (BullMQ had 5.10.1 → type clash); `apps/api`
  tsconfig `declaration:false`.
- ⚠️ **Blocker (now resolved):** no local Redis/Docker/WSL → chose **Upstash cloud Redis**.

### 2026-06-30 (cont. 2) — Redis live + lifecycle verified
- **Redis = Upstash** (free serverless). `REDIS_URL=rediss://default:…@grateful-wasp-43058.upstash.io:6379`
  in `apps/api/.env`. Gotchas hit on the way: pasted the REST `https://` URL first (ENOENT), then the
  read-only `default_ro` user (NOPERM), then a stray trailing char in the URL (Invalid URL). Final
  full-access `default` URL works; ioredis auto-TLS for `rediss://`.
- **B1.2 verified end-to-end**: `POST /jobs` → enqueue → worker `[processing]→[completed]` round-trip
  through Upstash. ✅
- **B1.3 `GET /jobs/:id` built & verified**: `jobs/status.ts` `mapState()`, route returns
  `{ jobId, status, result, error }`; polled queued/processing → completed `{ok:true}`; unknown → 404.
  Worker stub delay bumped 500ms → **7000ms** so `processing` is observable across 2s polls.
- ⚠️ **TODO: rotate the Upstash token** — it appeared in an ioredis crash stack trace (in task logs).

**▶ Resume next session at: B1.4** — replace the worker stub with a mock `JobResult` (echo input image
as `outputImage` + 2–3 fake products w/ Amazon affiliate URLs). Then promote `JobStatus` /
`GetJobResponse` / `JobResult` / `Product` into `packages/contract` (the deferred GET shapes).

### 2026-06-30 (cont. 3) — B1.4 template + contract promotion → **B1 complete**
- **B1.4 template stub**: `worker.ts` `buildStubResult(JobData): JobResult` echoes input image + 3 fake
  products w/ well-formed Amazon affiliate URLs (`https://www.amazon.<tld>/s?k=<keyterm>&tag=<tag>`).
  Clearly marked TEMPLATE/STUB with `TODO(B2)`. Verified via GET (completed, 3 products, echoed image).
- **Contract promotion** (agreed shapes for this step only): `JobStatus`, `Product`, `JobResult`,
  `GetJobResponse` added to `packages/contract`. `apps/api` now consumes them — `status.ts` imports
  `JobStatus`, `worker.ts` types the stub as `JobResult`, GET route returns `GetJobResponse`. Only
  `ApiError` + constants remain deferred (not promoted "beforehand").
- Builds clean; runtime round-trip unchanged.

**▶ Resume next session at: B2.0** — pipeline scaffolding (typed step interface + ordered runner,
per-step logging, shared AI client config), then **B2.1** Gemini Flash-Lite prompt enhancement. The
public contract (POST/GET shapes) must stay **unchanged** as the stub is replaced by the real pipeline.
⚠️ Still TODO: rotate the Upstash dev token (leaked in an earlier crash trace); set `AMAZON_AFFILIATE_TAG`.

### 2026-06-30 (cont. 4) — B2.0 scaffolding + B2.1 Model 1 (Gemini prompt enhance)
- **New module `apps/api/src/pipeline/`**: `context.ts` (`PipelineContext`), `step.ts`
  (`PipelineStep<In,Out>` + `runStep()` timing/structured-logging wrapper, fail-fast rethrow),
  `ai/gemini.ts` (lazy `GoogleGenAI` singleton — throws if `GEMINI_API_KEY` empty; `generateText()`
  with `AbortController` hard timeout, returns trimmed `response.text`), `steps/enhancePrompt.ts`
  (Model 1, interior/furniture system instruction, empty guard + 1200-char clamp), `runner.ts`
  (`runPipeline(data, ctx)`: step 1 REAL, steps 2–4 stubbed in-runner with `TODO(B2.2–B2.4)`).
- **`worker.ts`** now delegates to `runPipeline` (inline stub helpers removed). **`config.ts`**: pinned
  `gemini.model = gemini-2.5-flash-lite`, added `gemini.timeoutMs`. **`.env.example`** updated.
- **No `packages/contract` change** (Model 1 adds no public shape; `JobResult` stable). `pnpm build:api`
  clean. User set `GEMINI_API_KEY` + model in `apps/api/.env`.
- Decision: automated test **deferred** (manual endpoint verification first).

**B2.1 verified live (2026-06-30)**: POST → worker logged `[pipeline] <jobId> enhancePrompt ok` + the
enhanced prompt → poll GET → completed `JobResult`. Model 1 confirmed against live Gemini.

**▶ Resume next session at: B2.2** — Replicate Qwen Image 2.0 edit (feed `enhancedPrompt` + input image,
await prediction, fetch output → base64; replace the runner's `outputImage` stub). Keep `JobResult`
contract unchanged. ⚠️ Still TODO: rotate the Upstash dev token; set `AMAZON_AFFILIATE_TAG`.

### 2026-06-30 (cont. 5) — B2.2 Model 2 (Replicate Qwen Image 2.0) — **real image edit live**
- **New `pipeline/ai/replicate.ts`** (mirrors `ai/gemini.ts`): lazy `Replicate` singleton (throws if
  `REPLICATE_API_TOKEN`/`REPLICATE_MODEL` missing); `editImage()` builds nothing — caller passes a
  data-uri — calls `replicate.run(model, { input: { image, prompt, match_input_image:true,
  enable_prompt_expansion:false }, signal })`, normalizes single-vs-array output, reads bytes via
  `FileOutput.blob()` (URL-string fallback), `AbortController` timeout. `resolveMime()` validates the
  real content-type against `OutputImageMime`, else falls back to input mime.
- **New `pipeline/steps/editImage.ts`**: `PipelineStep<EditImageInput, EditImageOutput>` — builds the
  `data:<mime>;base64,<bytes>` URI, calls the client, guards empty output.
- **`runner.ts`**: step 2 now REAL (`runStep(editImageStep, …)`), echo stub removed; steps 3–4 still stub.
- **`config.ts`**: added `replicate.timeoutMs` (`REPLICATE_TIMEOUT_MS`, 120000). **`.env.example`** updated.
- **Contract change (user-approved)**: added `OutputImageMime` (jpeg/png/**webp**) → `JobResult.mimeType`;
  surfaced by the type-checker (Qwen returns a wider format set than the strict input `ImageMime`).
- **Decisions this step**: `replicate.run()` blocking + own timeout · `match_input_image:true` +
  `enable_prompt_expansion:false` · 120s timeout · output mime = Replicate's real content-type.
- **Verified live**: POST `sample-image.jpeg` (backyard) + "add a mid-century tan leather sofa + tall
  potted plant" → `enhancePrompt ok (5.9s)` → `editImage ok (7.2s)` → `completed` in ~16s. Output is a
  real edit (sofa + fiddle-leaf fig, room structure preserved), `mimeType image/png`, not the input echo.
  Products still the 3 stubs (expected). Build (contract + api) clean under TS strict.
- **Manual verification by user (Postman, 2026-06-30)**: happy path (202 → poll → completed, edited image
  viewed via Postman Visualizer) confirmed; also hit a transient Gemini 503 which correctly ended the job
  `failed` (failure path validated). Added `apps/api/VERIFY.md` (reusable manual checklist, Postman-first).
- **New working agreements (this session)**: (1) approval-before-edit — no code/file change without the
  user's OK first; (2) every step ends with a manual Postman verification checklist the user runs.

**▶ Resume next session at: B2.3** — Gemini Flash-Lite **vision** key-term extraction: add
`steps/extractKeyterms.ts` (`editedImage → string[]`, max 5), reuse the shared Gemini client (add a
vision/image-input path to `ai/gemini.ts`), replace `STUB_KEYTERMS` in `runner.ts`. Keep `JobResult`
shape stable. ⚠️ Still TODO: rotate the Upstash dev token; set `AMAZON_AFFILIATE_TAG`.
