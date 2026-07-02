# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ClickRetina is a mobile app where a user submits **an image of a room/space + a text prompt**, and the backend runs a **3-model AI pipeline** that returns an **edited image** plus **Amazon affiliate search links** for each detected product. See `architecture.md` for the full design and locked phase-1 decisions; `plan.md` for the phased roadmap; `task.md` for the live task checklist and session log.

> **Project status: MVP working end-to-end (as of 2026-07-01).** Backend **B0–B2 complete & user-verified live**: full job lifecycle (`POST /jobs` → BullMQ worker → `GET /jobs/:id` polling) running the real 3-model pipeline (`enhancePrompt → editImage → extractKeyterms → Amazon URLs`) with a real edited image + real product keyterms + affiliate links. Frontend **F0–F2 complete & verified live in Expo Go**: `apps/mobile` Expo SDK 57 app (top-tab nav, capture/resize/submit, results grid + poller + detail). `packages/contract`, `apps/api`, and `apps/mobile` all exist. **Remaining:** frontend **F3 (polish)** + backend **B3 (hardening, incl. tests — no test runner wired yet)**. Always check `task.md` for the current focus and resume point before starting work, and tick off / annotate tasks there as you complete them.

## Repository layout (pnpm workspaces)

```
apps/api/          # Express + TypeScript API — server + separate BullMQ worker process (both live)
apps/mobile/       # Expo SDK 57 React Native app (expo-router, Zustand) — F0–F2 done
packages/contract/ # Zod schemas + inferred types, single source of truth — imported by api & mobile
```

Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`). The shared contract package is intended to be imported by *both* `apps/api` and `apps/mobile` via workspace link — keep request/response shapes defined there once, never duplicated.

## Commands

Run from the repo root:

```bash
pnpm install            # install all workspaces
pnpm dev:api            # tsx watch on apps/api (dev server, http://localhost:54321)
pnpm dev:worker         # tsx watch on the BullMQ worker (separate process — needed to run jobs)
pnpm build:api          # tsc build apps/api -> dist/
pnpm start:api          # node dist/index.js (requires build first)
pnpm start:worker       # node dist/jobs/worker.js (requires build first)
pnpm dev:mobile         # expo start on apps/mobile (Expo Go; set apps/mobile/.env first)
```

The pipeline only runs when **both** `dev:api` and `dev:worker` are up. These root scripts are thin wrappers over `pnpm --filter @clickretina/api <script>` (and `@clickretina/mobile`). To target a specific workspace directly use `pnpm --filter <pkg> <script>`.

There is **no lint/format setup and no test runner configured yet** (both are planned — ESLint/Prettier and tests land in B3.4). Do not assume `pnpm test`/`pnpm lint` exist; if you add them, wire them up at the root and per package. TypeScript itself is the current gate (`pnpm build:api`, `tsc --noEmit` in mobile).

## Environment & tooling quirks (important)

- **Package manager is pnpm** (v11.9.0 via corepack), **not npm**. Use `pnpm`.
- On this Windows machine, the global `pnpm` shim was installed into `%AppData%\npm` (an npm prefix already on PATH) via `corepack enable --install-directory`, because `C:\Program Files\nodejs` requires admin. If `pnpm` isn't found, that shim is the reason to check.
- **Supply-chain build gate:** dependency build/postinstall scripts are blocked by default and must be allow-listed under `allowBuilds:` in `pnpm-workspace.yaml`. Currently approved: `esbuild`, `msgpackr-extract`, `protobufjs`, `@google/genai`. If a new dep needs a build step, add it there deliberately.
- Copy `.env.example` to `.env` (in `apps/api`, since `config.ts` uses `dotenv/config`). Required at runtime: `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, `REPLICATE_MODEL` (matching `REPLICATE_PROVIDER`); `AMAZON_AFFILIATE_TAG` optional (URLs still build, tag appended empty). `REDIS_URL` defaults to `redis://127.0.0.1:6379`, but **dev uses Upstash cloud Redis** (`rediss://…upstash.io:6379`; ioredis auto-TLS for `rediss://`) since there's no local Redis on this machine — ⚠️ Upstash exposes a read-only `default_ro` user; use the full-access `default` URL.
- **`apps/mobile/.env`** needs `EXPO_PUBLIC_API_BASE_URL` (Android emulator `http://10.0.2.2:54321`; physical phone = your LAN IP).

## Code conventions

- **ESM everywhere.** `apps/api` is `"type": "module"` with TS `module`/`moduleResolution: NodeNext`. **Relative imports must use the `.js` extension** (e.g. `import { config } from './config.js'`) even though the source file is `.ts` — match the existing imports in `src/index.ts`.
- TypeScript is `strict` (inherited from `tsconfig.base.json`); each package extends that base.
- API errors use a consistent envelope: `{ error: { code, message } }` (see the 404 handler / `http/errors.ts`). The `ApiError` shape is still **deferred** in `packages/contract` (per the endpoint-first, contract-second workflow — add it there when a client actually needs it).
- **Contract workflow (locked):** a Zod schema/constant is promoted into `packages/contract` **only after** its endpoint is built and manually verified — endpoint first, contract second. Don't front-load shapes.

## Architecture essentials (implemented)

The job lifecycle is **async via polling**, backed by Redis only (no DB, no auth, anonymous):

1. `POST /jobs` — validate body (Zod `CreateJobRequest`: base64 image + mimeType + prompt) → enqueue a BullMQ job → return `202 { jobId }` immediately.
2. **BullMQ worker** (separate process, fail-fast, no retries) runs the pipeline:
   - Model 1 — Gemini Flash-Lite (**vision**): input image + prompt → enhanced, preservation-first add-only prompt
   - Model 2 — **FLUX Kontext Pro** via Replicate: input image + enhanced prompt → edited image. Provider is **env-swappable** (`REPLICATE_PROVIDER` = `qwen` | `kontext`, default `qwen`); Kontext Pro chosen after manual A/B (better room preservation, no furniture spam)
   - Model 3 — Gemini Flash-Lite (vision): edited image → up to 5 product key-terms
   - Amazon link builder: each key-term → `https://www.amazon.<TLD>/s?k=<keyterm>&tag=<AFFILIATE_TAG>`
3. `GET /jobs/:id` — map BullMQ state → `JobStatus` (`waiting/delayed`→`queued`, `active`→`processing`, else as-is) and return `result` (when completed) or `error` (when failed). Client polls until terminal.

Finished jobs are evicted from Redis after `JOB_TTL_SECONDS` (default 600s / 10 min). Images travel as **base64 in JSON** (no object storage in phase 1); client resizes to 768px JPEG before encoding; API enforces `MAX_BODY_SIZE` (~10mb). Any model failure → job `failed` with a client-safe message. Exact model IDs are env-configurable (`GEMINI_MODEL`, `REPLICATE_MODEL`) and unset by default.

The public contract (request/response shapes in `architecture.md` §6) stayed **stable across the stub worker (B1) → real pipeline (B2)** transition, as the phased plan intended. Keep it that way: any change to those shapes must go through `packages/contract` and stay backward-compatible with the mobile client.
