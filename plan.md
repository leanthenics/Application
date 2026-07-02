# ClickRetina — Build Plan (Phased)

> Companion to `architecture.md`. Phases are ordered; backend leads so the contract is proven
> before the AI wiring and before the app consumes it. Detailed task breakdown for the first
> backend phase lives in `task.md`.

## Backend phases

### B0 — Monorepo & contract foundation
Goal: workspace skeleton + the shared Zod contract that everything imports.
- pnpm workspace (`pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`).
- `packages/contract`: Zod schemas + inferred types (section 6 of architecture.md), built so both
  `apps/api` and `apps/mobile` can import it via workspace link.
- Shared lint/format/TS config.

### B1 — API + queue skeleton with STUB worker  ← **FIRST BACKEND STEP (see task.md)**
Goal: full job lifecycle works end-to-end with a mock pipeline (no real AI yet), so polling and
the contract are proven.
- Express app, `POST /jobs` (validate → enqueue → `202 { jobId }`), `GET /jobs/:id` (map BullMQ
  state → `JobStatus`, return result/error), `GET /health`.
- BullMQ queue + worker bootstrap, Redis connection, body-size limit, central error handler.
- **Stub worker**: returns a mock `JobResult` (echoes input image as output, fake products) after
  a short delay — lets us validate queued→processing→completed transitions.

### B2 — Real AI pipeline
Goal: replace the stub with the 3-model pipeline.
- Model 1: Gemini Flash-Lite prompt enhancement.
- Model 2: Replicate image edit (feed base64/data-uri, get edited image back). Provider is
  env-swappable (`REPLICATE_PROVIDER` = `qwen` | `kontext`); **FLUX Kontext Pro chosen** (2026-07-01).
- Model 3: Gemini Flash-Lite vision → up to 5 product key terms.
- Amazon affiliate URL builder (env tld + tag, one URL per product).
- Wire into worker with fail-fast error propagation → `failed` + message.

### B3 — Hardening
Goal: production-readiness for an MVP.
- Input validation edge cases, body/size rejection, mime checks.
- Job/result TTL + cleanup, structured logging, request IDs.
- Config validation on boot (fail if required env missing).
- Basic tests (contract validation, endpoint happy/fail paths, URL builder).

## Frontend phases (after B1 contract is stable)

### F0 — Expo scaffold + contract import — ✅ DONE (2026-07-01)
- Expo **SDK 57** TS app (`apps/mobile`), imports `@clickretina/contract`, top-tab nav via
  **`expo-router/ui`** (SDK 56+ dropped React Navigation compat), `EXPO_PUBLIC_API_BASE_URL` env config.

### F1 — Capture & submit — ✅ DONE (2026-07-01)
- Pick/take photo (bottom sheet), **resize to 768px + JPEG compress** via `ImageManipulator.manipulate`,
  base64 encode, enter prompt, `POST /jobs`. Verified live in Expo Go (backend receiving requests).

### F2 — Poll & result — ✅ DONE (2026-07-01)
- Results grid + single 2.5s poller (`GET /jobs/:id`), per-tile loading/processing/failed UI, detail
  screen (edited image + tappable Amazon product links), error states. Zustand store, in-memory.

### F3 — Polish  ← **IN PROGRESS (with backend B3)**
- Empty/error/retry UX, basic styling, deep-link to Amazon, simple history (in-memory).
- **Done (2026-07-02):** (1) **Retry on failed** — "Try again" button on the failed detail screen
  re-runs identical (same photo + prompt), replacing the old entry (`addJob(new)` → `router.replace` →
  `removeJob(old)`); covers both real failures and expired jobs. (2) **Before/after compare** — drag-to-wipe
  `CompareSlider` on the completed detail screen (result base layer + original clipped to a draggable
  divider; RN `PanResponder`, horizontal-only so vertical scroll still works). Both in `job/[id].tsx`.
- **Remaining:** styling pass, Amazon deep-link robustness, grid pull-to-refresh / clear-completed.

## Sequencing

1. **B0 → B1** first (this is what we start with; `task.md`).
2. **B2** once the lifecycle is proven.
3. **F0 → F1 → F2** can begin in parallel once B1's contract + endpoints are stable.
4. **B3** + **F3** to finish the MVP.
