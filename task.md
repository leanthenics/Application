# ClickRetina — Backend Tasks

> Full backend workflow, divided into sequential, checkable steps so we can design and verify one
> step at a time. See `architecture.md` for decisions/contract and `plan.md` for the roadmap.
> Frontend phases (F0–F3) are tracked in `plan.md`; **F0–F2 are DONE (2026-07-01)** — see the frontend
> session-log entry at the bottom. Only F3 (polish) remains.
>
> **Update this file as we go** — flip the box and add notes when a task is done.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done
**Current focus (2026-07-10):** **AUTH via Supabase (login/signup + user DB) — Steps 1–3 DONE**
(email/password + email-confirmation deep link `clickretina://auth-callback`, PKCE, on a **dev build** —
off Expo Go). Next (tomorrow) = **Step 4 profiles** (table+RLS+trigger, display name) + a **UI overhaul**
(top tabs → **bottom nav**, add a **top bar → Settings page** with profile info + logout), then Step 5
(API JWT verification → user-owned jobs) + Step 6 (Google OAuth). See the auth session-log entry below and
memory `project-auth-supabase`. **Prior focus:** **GARDENS-ONLY PIVOT + STYLE PICKER — backend
Postman-verified, frontend built (2026-07-08).** Flow: Create (photo + optional text) → **Choose a style** (`GET /styles` grid) → Generate →
Results. Pipeline: `analyzeScene (landscape+observations) → enhancePrompt (style-driven) → editImage (nano,
positive masking) → extractKeyterms → Amazon`. **Owed: user runs mobile `tsc --noEmit` + live Expo Go
verify** (start `dev:mobile` first so typed routes pick up `/style`). Then style preview images + quality
levers (input 768→1024, keyterm model→flash) + backend B3. **Frontend F0–F2 are COMPLETE** (Expo SDK 57: top-tab nav via `expo-router/ui`,
capture+resize+submit, results grid + 2.5s poller + detail with Amazon links — verified live in Expo Go).
**Backend B2 is COMPLETE** and the full
pipeline runs end-to-end — `enhancePrompt(vision) → editImage(Kontext) → extractKeyterms → Amazon URLs →
completed` with real data (edited image + up to 5 real product keyterms + affiliate links). Shipped across
B2: transient-retry net (429/503), GET read-skew fix, env-swappable Model 2 provider (Qwen | **Kontext
Pro** chosen; B2.7 dropped), Amazon URL builder (`pipeline/amazon.ts`), client-safe tiered errors
(`pipeline/errors.ts`), and a **vision-based Model 1** with a preservation-first, add-only prompt (5–8
cohesive items; background preserved). Contract unchanged throughout. **Model 1 prompt may want one more
verify pass** (item count). Deferred backend: **B3 hardening** + per-step **unit tests** (no test runner
yet → B3.4).

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

### B2.1 Model 1 — Gemini Flash-Lite (prompt enhancement) — **DONE & verified live (2026-06-30); upgraded to VISION (2026-07-01)**
- [x] Gemini client + `enhancePrompt(userPrompt) → enhancedPrompt`. `pipeline/steps/enhancePrompt.ts`.
      **Upgraded 2026-07-01 to vision** (`PipelineStep<EnhancePromptInput,string>` where input =
      `{ image, mimeType, prompt }`): now sees the input image via `generateFromImage()` (free-text path,
      `responseSchema` made optional) so it identifies the space and suggests only context-appropriate
      products. `runner.ts` passes `data.image`/`mimeType` into step 1.
- [x] Enhancement system prompt — **rewritten (2026-07-01)**: space-agnostic (indoor/garden/terrace/…),
      context-appropriate products only (fixes garden photo → indoor sofa/fireplace bug), **do NOT change
      the existing background/scene**, and **integrate items naturally INTO the scene** (scale/perspective/
      grounded contact shadows; not foreground paste); add each item once (no duplicate/spam). Output-only.
- [x] Guard: empty/garbage response → throw (fail-fast). Empty checked in both `generateText()` and the step;
      output clamped to 1200 chars.
- [ ] Unit test with a mocked Gemini response. — **deferred** (user: manual endpoint testing first; decide on
      test runner after). Worker now calls `runPipeline`; stub helpers removed from `worker.ts`.

### B2.2 Model 2 — Replicate image edit (Qwen | **FLUX Kontext Pro**) — **DONE & verified live (2026-06-30; provider switch 2026-07-01)**
- [x] Replicate client + `editImage({ dataUri, prompt, fallbackMime }) → { base64, mimeType }`.
      `pipeline/ai/replicate.ts` (lazy `Replicate` singleton, throws if token/model missing).
- [x] Feed input as **data-uri** (`data:<mime>;base64,<bytes>`); `replicate.run(model, { input })`;
      fetch output → base64.
- [x] **Env-swappable provider switch (2026-07-01)**: `buildInput(provider, dataUri, prompt)` selects the
      per-model input shape — `qwen` (`image`, `match_input_image:true`, `enable_prompt_expansion:false`)
      vs `kontext` (`input_image`, `aspect_ratio:'match_input_image'`, `prompt_upsampling:false`,
      `output_format:'png'`). Set via `REPLICATE_PROVIDER` (default `qwen`) + matching `REPLICATE_MODEL`;
      pure env swap, no code change. `config.replicate.provider` + `ReplicateProvider` type added.
      **Kontext Pro (`black-forest-labs/flux-kontext-pro`) chosen** after manual A/B (better room
      preservation, no furniture spam) — **user-verified working live 2026-07-01**.
- [x] Async states + timeout: `replicate.run` polls the prediction internally (rejects on `failed`);
      hard cap via `AbortController` = `config.replicate.timeoutMs` (`REPLICATE_TIMEOUT_MS`, default 120000).
- [x] Guard: empty/missing output → throw (`firstOutput()` + empty-base64 check).
- [x] Output mime: read Replicate's real content-type, validate via `OutputImageMime` (else fall back
      to input mime). **Contract widened**: added `OutputImageMime` (jpeg/png/webp) for `JobResult.mimeType`;
      input `ImageMime` stays strict (jpeg/png). Wired step into `runner.ts` (echo stub removed).
- [ ] Unit test with mocked Replicate client. — **deferred** (manual verification first, per standing decision).

### B2.3 Model 3 — Gemini Flash-Lite vision (key-term extraction) — **DONE & verified live (2026-06-30)**
- [x] `extractKeyterms(editedImage) → string[]` (max 5). `pipeline/steps/extractKeyterms.ts` feeds the
      **edited** image as `inlineData` to `generateFromImage()` (new vision helper in `ai/gemini.ts`).
- [x] Vision prompt returns clean, search-ready descriptive terms (material/color/style; no brand/price).
- [x] **Structured output**: `responseMimeType:'application/json'` + `responseSchema` (array of strings);
      parsed with `JSON.parse` + Zod `z.array(z.string())`. Normalise: trim, dedupe (case-insensitive), cap 5.
- [x] Empty-list behaviour (decided): **fail the job** (`throw 'No products detected in the image'`).
- [x] Wired into `runner.ts` (replaced `STUB_KEYTERMS`/`stubProducts`); products now carry real keyterms.
      Verified live: 5 real terms (e.g. "mid-century brown leather sofa", "potted fiddle leaf fig").
- [ ] Unit test with mocked vision response. — **deferred** (manual verification first, per standing decision).

### B2.6 Resilience — transient-retry safety net + GET race fix — **DONE & verified live (2026-06-30)**
- [x] **Per-call retry** (`pipeline/ai/retry.ts` `withRetry`): retries **only on 429/503**, 3 attempts
      total (`AI_MAX_RETRIES`), exponential backoff + jitter (`AI_RETRY_BASE_MS`), honors `Retry-After`.
      Wraps `generateText`, `generateFromImage`, `editImage`. BullMQ stays `attempts:1`. Config in
      `config.ai.retry`; `.env.example` documents the knobs. **Verified live**: caught a real Gemini 503,
      retried (`[retry] … attempt 1 failed (status 503); retrying in 846ms`) → job recovered; also saw the
      exhaustion path (3×503 → fail-fast) work.
- [x] **GET `/jobs/:id` read-skew race fix** (`routes/jobs.ts`): `getJob` snapshot taken before
      `getState()` could return `completed` with `returnvalue` still null → client saw `completed` + null
      result. Now re-reads the job once when state is terminal but result/reason is missing.
- ✅ Follow-up (RESOLVED 2026-07-01, in B2.5): failures no longer surface **raw provider JSON** — the
      worker maps them to a **client-safe message** via `pipeline/errors.ts` `toClientSafeMessage`
      (tiered busy/timeout/generic). Raw detail stays in server logs only.

### B2.7 Edit fidelity — preserve original room, no furniture spam — **DROPPED (2026-07-01)**
> **Resolved by model choice, not by prompt/inpainting tuning.** Switching Model 2 to **FLUX Kontext
> Pro** (B2.2 provider switch) preserves the original room and avoids duplicated/spammed furniture well
> enough on manual A/B that no dedicated fidelity work is needed. If a future model regresses on this,
> revisit the ideas below (tighten Model 1 prompt; add a `negative_prompt`; masked/region inpainting).
- [~] ~~Diagnose current behaviour (model sometimes reshapes the room or repeats items).~~ — Kontext Pro
      does not exhibit this on tested samples.
- [~] ~~Tighten Model 1 enhancement prompt / add negative_prompt / evaluate inpainting.~~ — not needed.
- [x] Manual A/B on sample images (Qwen vs Kontext Pro) — **Kontext Pro chosen; `JobResult` unchanged.**

### B2.4 Amazon affiliate URL builder — **DONE & user-verified live (2026-07-01)**
- [x] `buildAmazonUrl(keyterm) → url` using `AMAZON_TLD` + `AMAZON_AFFILIATE_TAG`. Extracted from the
      inline `stubAmazonUrl` into its own module `pipeline/amazon.ts` (real B2.4 builder; same URL shape).
- [x] URL-encode keyterm; map each keyterm → `Product { keyterm, amazonUrl }`. `runner.ts` step 4 now
      imports `buildAmazonUrl` (inline stub removed); output byte-identical.
- [~] Unit test for encoding + tag/tld composition. — **deferred** (no test runner yet; user chose
      extract-module-only, decide runner in B3.4).

### B2.5 Wire pipeline into worker
- [x] Replace stub: Model 1 → 2 → 3 → URL builder, producing `PipelineOut`. `runner.ts` composes all
      three real steps + the (still inline) Amazon URL builder → `JobResult`.
- [x] Fail-fast: any step throws → job `failed` with a **client-safe message**. `pipeline/errors.ts`
      `toClientSafeMessage(err)` (tiered: 429/503 → "busy, try again"; `AbortError`/timeout → "took too
      long"; else generic — deliberately NOT per-stage, so the client never learns which model failed).
      `worker.ts` logs the raw error server-side then rethrows the sanitized message → BullMQ stores it as
      `failedReason`. `getStatus` exported from `ai/retry.ts` and reused. **User-verified live 2026-07-01**
      (generic + timeout tiers confirmed via Postman; raw detail stays in worker logs only).
- [x] End-to-end manual run with a real sample image → completed result. **User-verified live 2026-07-01
      for BOTH providers** (Qwen and FLUX Kontext Pro) — pipeline runs green end-to-end. (Runtime-verified
      via `dev:worker`/tsx; a strict `pnpm build:api` typecheck is still worth doing at the next code touch.)

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

### 2026-06-30 (cont. 6) — B2.3 Model 3 (vision) + retry safety net + GET race fix — **all live**
- **B2.3 Model 3**: `ai/gemini.ts` gained `generateFromImage()` (image `inlineData` + structured JSON via
  `responseMimeType`/`responseSchema`). New `steps/extractKeyterms.ts` feeds the **edited** image → up to 5
  descriptive keyterms (Zod-validated, trimmed/deduped/capped); empty list → **fail the job** (user choice).
  `runner.ts` now maps real keyterms → products (URL still inline `stubAmazonUrl`). No contract change.
- **Retry safety net (B2.6)**: new `ai/retry.ts` `withRetry` — retries only 429/503, 3 attempts total,
  exp backoff + jitter + `Retry-After`; wraps all three model calls. `config.ai.retry` +
  `AI_MAX_RETRIES`/`AI_RETRY_BASE_MS` in `.env.example`. Decisions: 3 attempts, 429/503 only, env-tunable.
- **GET race fix**: `routes/jobs.ts` re-reads the job once when state is terminal but `returnvalue`/
  `failedReason` is still null (was returning `completed` + null result).
- **Verified live (worker logs + Postman)**: full run `enhancePrompt ok → editImage ok → extractKeyterms
  ok → completed` with 5 real keyterms + edited PNG; retry **recovered** a live 503 (`retrying in 846ms`),
  and retry **exhaustion** (3×503) failed fast as designed. Postman happy path + Visualizer confirmed.
- **Manual-mode** execution throughout (per-edit approval). `gemini`/`replicate` clients refactored so each
  retry attempt re-arms its own `AbortController` timeout.
- ℹ️ Carry-overs resolved earlier: Upstash token rotated; `AMAZON_AFFILIATE_TAG` intentionally empty.
- ⚠️ Open follow-up: map model failures to a **client-safe error message** (raw provider JSON currently
  leaks into GET `error`) — B3 hardening.

**▶ B2 COMPLETE (2026-07-01).** Resume at: **discuss commit, then B3 (hardening) or frontend.**

### 2026-07-01 — Model 2 provider switch (Qwen | FLUX Kontext Pro); B2.7 dropped
- **Env-swappable Model 2 provider**: `pipeline/ai/replicate.ts` now builds the Replicate `input` via
  `buildInput(provider, dataUri, prompt)` — `qwen` (`image` / `match_input_image` / `enable_prompt_expansion`)
  vs `kontext` (`input_image` / `aspect_ratio:'match_input_image'` / `prompt_upsampling:false` /
  `output_format:'png'`), with an exhaustiveness guard. `config.ts` adds `replicate.provider`
  (`REPLICATE_PROVIDER`, default `qwen`) + exported `ReplicateProvider` type. `.env.example` documents the
  swap. Timeout/retry/mime handling + the `editImageStep` contract all unchanged.
- **Switching is a pure env swap** for the developer: set `REPLICATE_PROVIDER` + matching `REPLICATE_MODEL`.
- **FLUX Kontext Pro chosen** (`black-forest-labs/flux-kontext-pro`) after manual A/B — noticeably better
  room preservation / no furniture spam. **User verified it working live (2026-07-01).**
- **B2.7 (edit fidelity) DROPPED** — solved by the model choice, not prompt/inpainting tuning.
- Docs synced: `architecture.md` (tech stack, workflow, §7 config `REPLICATE_PROVIDER`, status header),
  `task.md` (this entry, current focus, B2.2, B2.7).
- ⚠️ Note: the provider-switch code was **not** re-run through `pnpm build:api` in-session (build was
  skipped); user confirmed the pipeline runs. Worth a `build:api` typecheck at the next code touch.

### 2026-07-01 (cont.) — B2.4 Amazon URL builder + B2.5 client-safe errors → **B2 COMPLETE**
- **B2.4** — extracted the inline `stubAmazonUrl` into `pipeline/amazon.ts` `buildAmazonUrl(keyterm)`
  (same URL shape, `AMAZON_TLD`/`AMAZON_AFFILIATE_TAG`, tag appended even when empty per §5). `runner.ts`
  step 4 now imports it; output byte-identical. Unit test **deferred** (no test runner; extract-only per
  user choice — revisit in B3.4).
- **B2.5** — client-safe failure messages: new `pipeline/errors.ts` `toClientSafeMessage(err)`, **tiered**
  (429/503 → "busy, try again"; `AbortError`/timeout → "took too long"; else generic), **deliberately not
  per-stage** (user rationale: the client shouldn't learn which model failed — e.g. no-products reads the
  same generic message). `getStatus` exported from `ai/retry.ts` and reused. `worker.ts` now try/catches
  `runPipeline`: logs the **raw** error server-side, rethrows the **sanitized** message → BullMQ stores it
  as `failedReason`. No contract / GET / route change. Resolves the B2.6 raw-JSON-leak follow-up.
- **User-verified live (2026-07-01, Postman)**: happy path unchanged; generic tier (broke a credential →
  `error` = "We couldn't process your image…", raw error only in worker log); timeout tier
  (`GEMINI_TIMEOUT_MS=1` → "This took too long…"). B2 signed off complete.
- **Working-agreement update**: user runs builds/servers/manual tests **themselves** — hand over the
  commands + a checklist, don't invoke `pnpm build:api`/`dev:*` (saved to working-style memory).

**▶ B2 committed & pushed at `778cb6a`.** Next chosen: **frontend F0** (after the Model 1 tweak below).

### 2026-07-01 (cont. 2) — Model 1 upgraded to VISION (space-aware products + scene preservation)
- **Problem:** Model 1 was text-only (never saw the image) with an "interior/furniture" system prompt, so
  a garden/terrace photo got indoor suggestions (sofa, fireplace). Root cause: blind model can't know the
  space. Decision (user): make Model 1 **vision-aware** (not just reword).
- **`ai/gemini.ts`**: `generateFromImage` `responseSchema` now **optional** — with schema = JSON (Model 3,
  unchanged); without = free text (Model 1). One conditional in the `config` block; Model 3 path untouched.
- **`steps/enhancePrompt.ts`**: input `string` → `{ image, mimeType, prompt }`; calls `generateFromImage`
  (no schema). **System prompt rewritten**: identify space from image → context-appropriate products only;
  **do not change existing background/scene**; **integrate items naturally into the scene** (scale/
  perspective/grounded shadows, not foreground paste); one of each item, no spam.
- **`runner.ts`**: step 1 now receives `data.image`/`data.mimeType`; header comment notes vision. No
  contract / GET change. **Vision confirmed working** (garden/terrace → space-appropriate products).

### 2026-07-01 (cont. 3) — Model 1 prompt tuning (preservation-first, then more items)
- **Iterated the Model 1 system prompt in `steps/enhancePrompt.ts`** (source of truth; user briefly edited
  `dist/*.js` — that's build output, gets overwritten; corrected to edit `src/` only).
- **Problem A — Kontext repainted the background.** Cause: prompt used transformation framing
  ("transform … into"), asked for 8–15 additions / "premium restyle", and buried the one preservation
  line. Fix: rewrote to an **ADD-ONLY, preservation-first** instruction — bans "transform/redesign/
  makeover", caps items, and **forces the output to end with** `"Keep the rest of the original image
  exactly as it is, unchanged."` (Kontext only sees Model 1's output, so the clause must live there).
  **Result: background now preserved.** ✅
- **Problem B — too few items rendered (1–2).** Cause: Kontext's per-pass edit budget + a discrete
  "Add X. Add Y." checklist (it applies the first, drops the rest). Fix (user chose **prompt-tweak first**
  over multi-pass): bumped requested items **3–6 → 5–8** and switched output style to **one cohesive
  furnishing paragraph** (weave items together, not a checklist). Raised `MAX_ENHANCED_LENGTH` **1200 →
  2000** so the trailing preservation clause is never truncated. **Pending user verify** (expect more
  items placed; background still intact).
- ⚠️ Known ceiling: Kontext renders only a handful of additions per pass. If 5–8 isn't enough after
  testing, next lever is **multi-pass editing** (loop `editImage` 2–3×, feed output back) — deferred.

**▶ Resume next session at: FRONTEND F0** — Expo (TS) scaffold, import `@clickretina/contract`, base
navigation, API base-URL env config. Backend B2 is complete (Model 1 vision + prompt tuning may need one
more verify pass). Deferred backend: B3 hardening + per-step unit tests (no test runner yet).

### 2026-07-01 (cont. 5) — FRONTEND F0–F2 (Expo app) — verified live in Expo Go
- **F0 scaffold + wiring**: `apps/mobile` via `create-expo-app` (**Expo SDK 57**, RN 0.86, react 19.2,
  expo-router; routes under **`src/app/`**). Renamed `@clickretina/mobile`, imports `@clickretina/contract`
  (`workspace:*`). **No `metro.config.js`** — SDK 52+ auto-configures monorepo Metro (pnpm isolated linker
  worked; `nodeLinker: hoisted` fallback not needed). Added `expo-env.d.ts`, `.env.example`, root
  `dev:mobile` script, camera/photo permission strings in `app.json`.
  - **⚠️ SDK 56+ breaking change**: expo-router dropped React Navigation compat — the
    `withLayoutContext(createMaterialTopTabNavigator())` pattern throws. Rebuilt the **TOP** tab bar
    (Home | Results) with **`expo-router/ui`** (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`, `TabList` before
    `TabSlot` = top). Removed `@react-navigation/material-top-tabs` + `react-native-pager-view`.
- **F1 capture & submit** (`src/app/(tabs)/index.tsx`): image card → `image-source-sheet.tsx` bottom sheet
  (Camera/Gallery) → picked image covers card + pencil to change → prompt + `→` button. `src/lib/image.ts`
  uses new SDK 57 APIs: `expo-image-picker` (`mediaTypes:['images']`) + `ImageManipulator.manipulate(uri)
  .resize({width:768}).renderAsync().saveAsync({JPEG, base64})`. Submit → `createJob` → `addJob` → go to
  Results. Icons via `@expo/vector-icons`.
- **F2 grid + poller + detail**: `store/jobs.ts` (**Zustand v5**), `api/client.ts` (`createJob`/`getJob`,
  contract-validated, typed `ApiError`), `hooks/use-job-poller.ts` (one 2.5s interval in root layout, polls
  non-terminal jobs, 404→expired), `(tabs)/results.tsx` (2-col grid, status overlays, output when done),
  `job/[id].tsx` (spinner / client-safe error / output + Amazon products, tap → `Linking.openURL`).
- **API base URL** = `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` (emulator `http://10.0.2.2:54321`;
  physical phone LAN IP). Android toolchain (Studio/SDK/emulator `ClickRetina_API36`) configured.
- Contract UNCHANGED; every step typechecked clean (`tsc --noEmit`). **Left for tomorrow: F3 polish + B3.**

**▶ Resume next session at: FRONTEND F3 (polish)** + backend **B3 (hardening)** — both deferred 2026-07-01.

### 2026-07-02 — Model 1 prompt tuning (more items + warmth + preservation) & Frontend F3 (retry + compare)
- **Model 1 (`enhancePrompt.ts`) prompt tuned** (all user-verified live this session):
  - **More items**: bumped 8–10 → **12–15**; flipped the old "don't overcrowd / breathing room" line to
    "make the space feel full, layered and lived-in"; added a category list (seating, tables, lighting,
    planters/greenery, rugs, shade, decor accents) to give the model more to draw from.
  - **Duplication rule made generic**: instead of "each item appears once / no repeating a category", now
    bans only unnatural copy-paste clones but allows realistic multiples (a few chairs, several planters…).
  - **Warmth (scoped to added items only)**: new paragraph — warm materials/tones (warm woods, rattan,
    terracotta, amber/ochre/cream textiles) + added lamps cast a warm glow **only on/around themselves**,
    explicitly NOT a global relight (a global "make it warmer" would recolor the background → drift).
  - **Preservation hardened**: moved a strong CRITICAL block to the **top** naming fixed structures
    (concrete pillars/columns/beams/railings) as immovable, AND restated it in a beefed-up closing clause
    (replacing the old "Keep the rest… unchanged." one-liner). Paragraph length 3–5 → **5–7 sentences**;
    `MAX_ENHANCED_LENGTH` stays 2000. **Old prompt kept commented out** as a labeled fallback (user asked).
- **Frontend F3 items** (both in `apps/mobile/src/app/job/[id].tsx`; no backend/contract/store change):
  - **Retry on failed** — "Try again" button on the failed detail state re-runs identical (same photo +
    prompt via `prepareForUpload(inputThumbUri)` → `createJob`), **replaces** the old entry
    (`addJob(new)` → `router.replace('/job/newId')` → `removeJob(old)`); the app-wide poller picks up the
    new queued job. Handles cached-photo-gone / network errors inline. Covers real failures AND expired jobs.
  - **Before/after compare** — drag-to-wipe `CompareSlider`: result (after) as base layer, original
    (`inputThumbUri`, before) clipped from the left to a draggable divider (white handle + `swap-horizontal`
    icon, starts centered, static Before/After labels). RN core **`PanResponder`** (no new dep); claims only
    clearly-horizontal drags so vertical `ScrollView` scroll still works. Added `overflow:'hidden'` to the
    image container. Confirmed `router.replace` + approach against Expo v57 docs per `apps/mobile/AGENTS.md`.
- **Docs refreshed**: stale **CLAUDE.md** header/layout/commands/Model-2 (Qwen→Kontext) brought up to date.
- ⚠️ Per standing agreement the user runs builds/tests; a `tsc --noEmit` (mobile) + `pnpm build:api` typecheck
  are still worth a pass at the next code touch.

### 2026-07-06 — Amazon affiliate tag live + third Model 2 provider (Google Nano Banana)
- **Amazon affiliate tag now set**: `AMAZON_AFFILIATE_TAG=viralboost04-21` (`AMAZON_TLD=in`) in
  `apps/api/.env` — product links now build as `https://www.amazon.in/s?k=<keyterm>&tag=viralboost04-21`.
  No code change (env-driven via `config.amazon`); restart worker/api so the new env is read at boot.
- **Model 2 third provider added: `nano` (Google Nano Banana) — USER-VERIFIED WORKING LIVE 2026-07-06**
  (now the active provider; full pipeline runs green end-to-end; nano accepts the base64 data-URI in the
  `image_input` array). Added for A/B testing image-edit models.
  Newest Nano Banana 2 Lite isn't on Replicate yet; base `google/nano-banana` (Gemini 2.5 Flash Image) is.
  - `config.ts`: `ReplicateProvider` type extended `'qwen' | 'kontext' | 'nano'`; provider comment updated.
    Code default stays `'qwen'`; env drives active provider.
  - `pipeline/ai/replicate.ts`: added `case 'nano'` to `buildInput` → `{ prompt, image_input: [dataUri],
    output_format: 'png' }` (nano takes an **array** of images; no aspect-ratio/match param — preserves
    input framing natively). Exhaustiveness guard, retry, timeout, `firstOutput`/`resolveMime` unchanged.
    Stale "Qwen Image 2.0" / "Qwen and FLUX Kontext" JSDoc comments refreshed.
  - `apps/api/.env`: active switch set to `REPLICATE_PROVIDER=nano` + `REPLICATE_MODEL=google/nano-banana`;
    Kontext pair kept commented for instant A/B flip-back.
  - **No contract change** (`OutputImageMime` already allows png). Model 1 prompt left **unchanged** by
    decision (one variable at a time; tune only if nano output regresses).
  - Docs synced: `architecture.md` (§2 provider note + §7 `REPLICATE_PROVIDER` enum), this entry, memory.
  - ⚠️ No `.env.example` exists in the repo (docs reference one, but it was never committed) — nothing to
    update there. ✅ Live run passed (nano verified working); `pnpm build:api` typecheck still worth a pass.

### 2026-07-06 (cont.) — Landing (Home) screen redesign + server-hosted showcase
- **New landing page** replaces capture as the first screen; capture/prompt moved to a new **Create** tab.
  Top tab bar now **3 tabs: Home | Create | Results** (`(tabs)/_layout.tsx`).
- **Backend — server-hosted showcase** (so before/after examples are swappable without an app rebuild):
  - `apps/api/public/showcase/` holds the images + a hand-editable `showcase.json` manifest + a README.
    Placeholder solid-color PNGs generated for 3 sample items (living-room / balcony / bedroom) — user
    replaces with real renders.
  - `routes/showcase.ts`: `GET /showcase` reads the manifest and expands each `keyterm` → `{ keyterm,
    amazonUrl }` via **reused `pipeline/amazon.ts` buildAmazonUrl** (real affiliate tag). Returns relative
    `beforeUrl`/`afterUrl` (`/showcase/assets/<file>`). Missing manifest → empty list; bad JSON/shape → 500
    envelope. `index.ts` mounts `express.static(showcaseDir)` at `/showcase/assets` + the router. Path
    resolved via `import.meta.url` (same in dev `src/` and built `dist/`). **Contract NOT promoted** (policy).
- **Frontend**:
  - Extracted `CompareSlider` → `components/compare-slider.tsx` (added optional `onInteract` fired on first
    touch via `onStartShouldSetPanResponder` returning false — observes without stealing the drag) and
    `ProductRow` → `components/product-row.tsx`. `job/[id].tsx` now imports both (no visual change).
  - `api/client.ts`: `getShowcase()` + local `ShowcaseItem` type (loose validation; absolutizes image URLs
    against `EXPO_PUBLIC_API_BASE_URL`).
  - New `(tabs)/index.tsx` landing: title **ClickRetina** + tagline, **Get started** CTA (→ Create tab),
    showcase cards (each reveals its product list on first slider interaction, pushing content down; loading/
    error+retry/empty states), **How it works** = 3 vertically-stacked "floating" step cards (Click it /
    Design it / Visualize it, icon + copy), and an empty **black bottom bar** (fixed 64px, edge-to-edge).
    Old capture screen copied verbatim to `(tabs)/create.tsx` (component renamed `CreateScreen`). Results
    empty-state copy updated to "Create tab".
- ⚠️ Owed (user runs): `pnpm build:api` + mobile `tsc --noEmit`; then live check — landing loads showcase,
  slider reveals products, Create tab still submits → Results. Drop real before/after images into
  `public/showcase/` + edit `showcase.json`.

### 2026-07-08 — Pipeline redesign: scene-analysis + prompt-enhance split (one job per model)
- **Why:** Model 1 was an over-loaded "designer" (returned a 12–16 item JSON plan). Handing nano that
  long "add all of this" plan drove background drift. Split the front of the pipeline so each model does
  one job and nano's own creativity picks the pieces. Plan approved this session.
- **New flow** (contract UNCHANGED; provider stays `nano`):
  1. **Model 1 `analyzeScene`** (NEW, `steps/analyzeScene.ts`) — Gemini **Flash** vision: original image →
     structured `SceneAnalysis` JSON (spaceType, setting, description, fixedElements, lighting, style,
     **editableZones** phrased *positively* — where new items may go). No product picks. Fail-fast on zero
     zones. Exports `SceneAnalysis` type + `renderSceneForEditor()` prose helper.
  2. **Model 2 `enhancePrompt`** (REWRITTEN) — Gemini **Flash** text: `{ prompt, scene }` → one cohesive
     render-friendly instruction via `generateText` (added optional `model` param to it). **No product
     checklist** (nano invents pieces); `richnessDirective(config.gemini.richness)` maps the 0–1 knob to
     minimal/modest/full/maximal wording. Old designer plan schema (`PLAN_SCHEMA`/`renderItem`/copy-cap)
     retired. **Non-fatal:** if Model 2 errors/returns empty it falls back to the raw user prompt (logs a
     warning) instead of failing the job — Model 3 wraps it with the zones + preservation regardless.
     **Toggle:** `MODEL2_ENABLED=false` skips Model 2 entirely and sends the raw user prompt to Model 3.
  3. **Model 3 `editImage`** — nano (unchanged provider). `EditImageInput` gains `scene`;
     `composeEditPrompt(instruction, scene)` now uses **positive/semantic masking**: names the editable
     zones edits go INTO + names `fixedElements` in the preservation clause (falls back to the generic
     list when scene absent). Kept the strong "same photograph / match lighting+framing+dimensions" rules.
  4. **Model 4 `extractKeyterms`** + Amazon builder — UNCHANGED (still Flash-Lite vision).
- **config.ts**: added `gemini.model2` (`GEMINI_MODEL_2`, default `gemini-2.5-flash`) + `gemini.richness`
  (`DESIGN_RICHNESS`, default `0.6`, clamped [0,1]); removed `model1MinItems`/`model1MaxItems`.
- **runner.ts** rewired: `analyzeScene → enhancePrompt(scene) → editImage(scene) → extractKeyterms →
  amazon`; logs a one-line scene summary + the enhanced prompt (no image payloads).
- **Docs**: `architecture.md` §2 model table, §4 workflow diagram + split note, §7 config table updated.
- ⚠️ **Owed (user runs):** `.env` edits — add `GEMINI_MODEL_2=gemini-2.5-flash` + `DESIGN_RICHNESS=0.6`,
  remove `MODEL1_MIN_ITEMS`/`MODEL1_MAX_ITEMS`; then `pnpm build:api` typecheck; live Postman run
  (specific + vague prompts) confirming `analyzeScene → enhancePrompt → editImage → extractKeyterms →
  completed`, background ~80–90%+ preserved; sweep `DESIGN_RICHNESS=0` vs `1`.

### 2026-07-08 (cont.) — Role fixes: Model 2 = pure enhancer, Model 3 preservation-first
- **Problem 1 — Model 2 was recommending products** (a "rooftop garden" prompt got sofas/chairs). Root
  cause: its system prompt told it to "add furniture and decor" and it saw the editable zones. **Fix:**
  Model 2 is now a **pure prompt enhancer** — rewrites the user's request into a clearer 1–3 sentence
  version of THE SAME request, strictly within the user's theme, and is explicitly barred from naming
  products/items/placements or introducing anything the user didn't ask for. It now sees only a
  **lightweight scene brief** (`renderSceneBrief`: space type + style + lighting — no zones, no fixed
  list), so it has no placement cues. `MAX_ENHANCED_LENGTH` 2000 → **600**.
- **Problem 2 — edited image drifted too much.** **Fix (two parts):** (a) **Model 1** now returns a much
  more concrete, nano-specific analysis — an **exhaustive, spatially-named `fixedElements`** (every
  structure + existing object, with where each sits) plus precise empty `editableZones`; (b) **Model 3**
  prompt rebuilt **preservation-first**: leads with "precise PHOTO-EDITING task, not generation", then an
  explicit PRESERVE-EXACTLY block (Model 1's fixed list + camera/framing/dimensions), then WHAT TO ADD
  (the enhanced request, bounded to it) + WHERE (the zones), then "everything else pixel-for-pixel
  identical". Positive/semantic masking, target 80–90%+ preserved.
- **Richness moved to Model 3.** The 0–1 `DESIGN_RICHNESS` knob now steers *how many fitting items nano
  adds* (`richnessDirective` in `editImage.ts`), not Model 2's wording — Model 2 no longer touches
  fullness. `config` comment updated.

### 2026-07-08 (cont. 2) — Gardens-only pivot + style picker + Model 1 richer analysis
- **Scope pivot (user):** app is now **gardens / outdoor spaces only**, with a **style picker** (Modern,
  Zen, Cottage, Mediterranean, Tropical, Desert, Farmhouse, Coastal, Boho, Woodland) chosen after capture,
  plus **optional** free text.
- **Style catalog = hand-editable server manifest** (`apps/api/public/styles.json`: id/label/blurb/
  imageUrl/guidance). `imageUrl` blank for now (swappable later). New `src/styles/catalog.ts` (cached
  loader, `getStyle`, `listStylesPublic`, mirrors showcase path-resolution) + `routes/styles.ts`
  **`GET /styles`** (returns id/label/blurb/imageUrl; internal `guidance` stays server-side), mounted in
  `index.ts`. Editing styles = edit JSON + restart API, no rebuild/app release.
- **Contract:** `CreateJobRequest` gains **`style`** (non-empty string; concrete ids server-driven so the
  contract only checks non-empty) and **`prompt` is now optional** (≤2000). Promotion noted in the contract
  doc header. POST `/jobs` validates the style id against the live catalog → **400 `invalid_style`** if
  unknown. `JobData` carries `style` + optional `prompt`.
- **Model 1 (`analyzeScene`) upgraded** to a richer garden analyzer: added **`landscape`** (terrain,
  surroundings, views, sun, existing greenery) + **`observations`** (3–6 neutral factual notes — the
  "ideas about the image", analysis-only, no products) alongside the exhaustive `fixedElements` + precise
  `editableZones`. Prompt reframed for outdoor/garden spaces. `landscape` now also feeds the Model 2 brief
  and the Model 3 preservation context.
- **Model 2 (`enhancePrompt`) is now STYLE-DRIVEN:** input `{ styleLabel, styleGuidance, prompt?, scene }`
  → one styled garden-redesign instruction that weaves the style aesthetic with the optional user text.
  Still no product/placement lists. Non-fatal fallback now uses a **style base instruction** (guidance +
  any user text), so it's always usable even with empty prompt / Model 2 off.
- **runner** resolves the style id → catalog entry (tolerant if manifest changed) and passes label/guidance
  into Model 2; logs style. **worker** log includes style.
- **Docs:** `architecture.md` §1 scope + style-catalog note, §4 diagram, §6 CreateJobRequest + endpoints
  (GET /styles, /showcase). Contract `JobResult`/GET unchanged.
- ⚠️ **Owed (user runs):** rebuild contract then api — `pnpm --filter @clickretina/contract build` then
  `pnpm build:api`; restart api+worker; **Postman**: `GET /styles` lists 10; `POST /jobs` with a valid
  `style` (e.g. `"zen"`) + no prompt, and with `"zen"` + prompt "add a water feature"; bad style → 400
  `invalid_style`. Check logs `analyzeScene → enhancePrompt(styled) → editImage → extractKeyterms →
  completed`, on-theme + background preserved. **Mobile is NOT updated yet** (contract now requires
  `style`) — the app's `POST /jobs` will 400 until the frontend style screen lands.

**▶ Backend Postman-verified live (2026-07-08).** Frontend style-picker built next (below).

### 2026-07-08 (cont. 3) — Frontend: style-picker screen + gardens copy pass
- **Backend verified first:** user confirmed `/styles`, `/jobs` (with `style`), bad-style 400, and output
  all working via Postman (after rebuilding the contract package — `dist` was stale, the "Unrecognized key
  style" gotcha). Root cause noted: `pnpm build:api` does NOT rebuild `@clickretina/contract`; run
  `pnpm --filter @clickretina/contract build` + restart `dev:api`/`dev:worker` after any contract change.
- **New flow:** Create (photo + optional text) → **Choose a style** (dedicated screen) → Generate → Results.
- **`api/client.ts`**: added `getStyles()` + `Style` type (`{id,label,blurb,imageUrl}`, imageUrl absolutized).
- **Stores**: new `store/draft.ts` (`useDraftStore` holds the pending `{imageUri,prompt}` — hand-off to the
  style screen without URL-encoding the file URI through router params). `store/jobs.ts` `Job` gains
  `style` + `styleLabel` (prompt may now be '').
- **`(tabs)/create.tsx`**: prompt is now OPTIONAL; only the photo is required. Arrow-submit replaced with a
  **"Choose a style"** button → `setDraft` + `router.push('/style')`. Copy → gardens.
- **`app/style.tsx` (NEW)**: fetches `getStyles()`, renders a **2-col image-card grid** (neutral leaf
  placeholder until `imageUrl` set) with single-select + check badge; **Generate** →
  `prepareForUpload(draft.imageUri)` → `createJob({image,mimeType,style,prompt?})` → `addJob(...styleLabel)`
  → `clearDraft()` → `router.replace('/results')`. Loading / error+retry / no-draft-guard states.
- **`_layout.tsx`**: registered `Stack.Screen name="style"` (title "Choose a style").
- **`job/[id].tsx` retry** now re-runs with the same `style` (+ styleLabel); completed view shows the
  "<Style> garden" label; "Restyling your space…" → "Designing your garden…".
- **Gardens copy pass**: landing tagline + How-it-works steps, `app.json` camera/photos permission strings,
  Create headings/placeholder ("photo of your outdoor space", "add optional details…").
- ⚠️ **Owed (user runs):** mobile `tsc --noEmit` (contract already rebuilt). **Start `pnpm dev:mobile`
  first** so expo regenerates typed-routes for the new `/style` route before typechecking. Then live in
  Expo Go: capture → Choose a style (grid loads from `/styles`) → Generate → Results → detail (compare +
  style label + shop). Optional next: drop real preview images into the style manifest `imageUrl`s;
  quality levers (input 768→1024, keyterm model→flash); backend B3 hardening + tests still deferred.

### 2026-07-08 (cont. 4) — Richness verified + hardened
- Confirmed the `DESIGN_RICHNESS` path end-to-end (`config.gemini.richness` → `richnessDirective` →
  nano "WHAT TO ADD" line). Offline sweep verified the clamp + buckets: 0→few(2-4), 0.3→modest(5-7),
  0.6(default)→full(8-12), 0.8-1→generous(12+); out-of-range clamps; bad value → 0.6 default.
- **Made the effect visible/robust:** bucket wording now carries **explicit count ranges** (vague
  adjectives alone didn't move nano); added a per-job worker log `[editImage] richness=X → "…"`; guarded
  non-numeric env → 0.6 (was silently NaN→max) in both `config.ts` and `richnessDirective`.

**▶ Resume next session at:** live-verify the mobile style flow in Expo Go; then style preview images +
quality levers, then B3.

### 2026-07-10 — Model 4 redesign: grouped + priced products, non-fatal
- **Goal (user):** Model 4 (product extraction) should return a **general INR price range** per item and
  **group items by category** (lighting / plants / …) for a scannable "shop the look".
- **Grouping approach (researched + chosen):** model emits the **whole grouped structure in ONE pass**
  (array of `{ group, items }`) — it invents the category names itself (no fixed list) but names each
  group once, so the naïve "Lights vs Lighting" duplicate-bucket problem can't occur. Belt-and-suspenders:
  runner-side merge of any same-name groups + cross-group keyterm dedupe.
- **Decisions locked:** price = AI-estimated `priceMin`/`priceMax` **numbers, INR**, rendered `₹1,000–3,000`
  (no "(est.)" per user); **nested** contract (`productGroups`, not flat `products`); **Model 4 bumped to
  Gemini Flash** (`GEMINI_MODEL` default `gemini-2.5-flash-lite → gemini-2.5-flash`); **model decides count**
  (safety cap 15 items); **NON-FATAL** — on any error/empty the runner falls back to a curated garden set
  (`FALLBACK_PRODUCT_GROUPS`) so a good edited image always ships (Gemini's last step won't sink the job).
- **Changes:**
  - `packages/contract`: `Product` gains optional `priceMin`/`priceMax`; new `ProductGroup`;
    `JobResult.products` → **`productGroups`**. (Rebuild the contract pkg — stale-`dist` gotcha.)
  - `extractKeyterms.ts`: nested `responseSchema` (groups→priced items), rewritten garden system prompt
    (self-chosen coherent groups + INR ranges), Zod + normalize (merge dup groups, dedupe terms, price
    sanity/swap, cap 15), throws on empty. Exports `ExtractedGroup`/`ExtractedItem` + `FALLBACK_PRODUCT_GROUPS`.
  - `runner.ts`: step 4 wrapped in try/catch → fallback; step 5 builds `ProductGroup[]` with per-item Amazon URLs.
  - `config.ts`: `gemini.model` default → `gemini-2.5-flash`.
  - Mobile: `product-row.tsx` shows `₹min–max` (INR `en-IN`, hidden when unpriced → showcase unaffected);
    `job/[id].tsx` renders `productGroups` as section-header groups. `store/jobs.ts` unchanged (imports `JobResult`).
  - Docs: `architecture.md` §2 (Model 4 → Flash), §4 diagram, §6 contract, §7 `GEMINI_MODEL` default.
- ⚠️ **Owed (user runs):** `pnpm --filter @clickretina/contract build` **then** `pnpm build:api`; mobile
  `tsc --noEmit`; set/confirm `apps/api/.env` `GEMINI_MODEL=gemini-2.5-flash` (or unset to take the new
  default), restart api+worker. **Postman:** run a real job → `GET /jobs/:id` result has `productGroups`
  with grouped, INR-priced items; force a Model 4 failure (e.g. bad `GEMINI_MODEL`) → job still **completes**
  with fallback products + the edited image. Then live Expo Go: detail screen shows grouped sections + ₹ prices.

### 2026-07-10 (cont.) — NEW WORKSTREAM: Auth via Supabase (login/signup + user DB)
> Auth was out of scope in phase 1 (`architecture.md` §8); now being added. Full detail + decisions live in
> memory `project-auth-supabase`. Executed in small verified steps. **Steps 1–3 DONE & user-verified.**
- **Step 1 — client foundation:** `apps/mobile/src/lib/supabase.ts` (createClient + AsyncStorage session +
  AppState auto-refresh). Env `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_KEY` (modern **publishable**
  key `sb_publishable_…`) in `apps/mobile/.env`. ⚠️ Install native/Expo deps with **`expo install`**, NOT
  `pnpm add` (SDK-version match — AsyncStorage 3.x vs Go's 2.2.0 caused `Native module is null`).
- **Step 2 — email/password auth + gating:** `store/auth.ts`, `hooks/use-auth-listener.ts`, `lib/auth.ts`
  (signUp/signIn/signOut), `app/(auth)/{_layout,sign-in,sign-up}.tsx`. Root `_layout.tsx` uses Expo Router
  **`Stack.Protected` guards** (`(tabs)/style/job` when authed, `(auth)` when not) + splash held until session
  known. Confirm-email ON → session only after confirm → gating handles it. Logout on Home footer (temporary).
- **Step 3 — email-confirmation deep link (PKCE):** `flowType:'pkce'`; signUp passes
  `emailRedirectTo = Linking.createURL('auth-callback')`; new `hooks/use-auth-deep-link.ts`
  (`Linking.useURL()` → `exchangeCodeForSession`) + `app/auth-callback.tsx` "Confirming…" screen (outside
  both guards). Supabase allow-list: `clickretina://auth-callback`.
- **Switched to a DEV BUILD** (off Expo Go) via local `expo run:android` — `app.json` package/bundle id
  `com.clickretina.app`; native folders gitignored (CNG). ⚠️ Windows CMake path wall on
  react-native-worklets → fixed with **`nodeLinker: hoisted`** in `pnpm-workspace.yaml` (needs clean
  reinstall + delete `apps/mobile/android`). Dev-client install hit a transient `@expo/schema-utils@57.0.1`
  propagation error (retry fixed it). EAS is the fallback if local builds keep failing.
- **Decisions for TOMORROW (Step 4 + UI overhaul):** (a) **profiles** table + RLS + `handle_new_user` trigger
  (user runs SQL); (b) **display-name** field at sign-up (`options.data.full_name`, Google auto-fills later);
  (c) **UI/UX:** top tabs → **modern bottom nav**; add a **top bar → Settings page** holding the user-profile
  section (all user info) + logout (moved off Home). Then Step 5 (API `jose`/JWKS → user-owned jobs) + Step 6
  (Google OAuth).

**▶ Resume next session (2026-07-11): Step 4 (profiles + display name) + the UI overhaul (bottom nav +
Settings page).** Backend Model-4 verify (above) still owed if not yet run.
