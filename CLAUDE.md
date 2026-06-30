# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ClickRetina is a mobile app where a user submits **an image of a room/space + a text prompt**, and the backend runs a **3-model AI pipeline** that returns an **edited image** plus **Amazon affiliate search links** for each detected product. See `architecture.md` for the full design and locked phase-1 decisions; `plan.md` for the phased roadmap; `task.md` for the live task checklist and session log.

> **Project status: early build.** Most of the system described in `architecture.md` is *planned, not yet implemented.* As of the latest session, only a minimal `apps/api` Express skeleton exists (`/health`, JSON body limit, 404 handler, `config.ts`). `packages/contract` and `apps/mobile` **do not exist yet**. Always check `task.md` for the current focus and resume point before starting work, and tick off / annotate tasks there as you complete them.

## Repository layout (pnpm workspaces)

```
apps/api/          # Express + TypeScript API (server; BullMQ worker planned)
apps/mobile/       # Expo React Native app — PLANNED, not created yet
packages/contract/ # Zod schemas + inferred types, single source of truth — PLANNED, not created yet
```

Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`). The shared contract package is intended to be imported by *both* `apps/api` and `apps/mobile` via workspace link — keep request/response shapes defined there once, never duplicated.

## Commands

Run from the repo root:

```bash
pnpm install            # install all workspaces
pnpm dev:api            # tsx watch on apps/api (dev server, http://localhost:54321)
pnpm build:api          # tsc build apps/api -> dist/
pnpm start:api          # node dist/index.js (requires build first)
```

These root scripts are thin wrappers over `pnpm --filter @clickretina/api <script>`. To target a specific workspace directly use `pnpm --filter <pkg> <script>`.

There is **no lint/format setup and no test runner configured yet** (both are planned — ESLint/Prettier in B0, tests in B3). Do not assume `pnpm test`/`pnpm lint` exist; if you add them, wire them up at the root and per package.

## Environment & tooling quirks (important)

- **Package manager is pnpm** (v11.9.0 via corepack), **not npm**. Use `pnpm`.
- On this Windows machine, the global `pnpm` shim was installed into `%AppData%\npm` (an npm prefix already on PATH) via `corepack enable --install-directory`, because `C:\Program Files\nodejs` requires admin. If `pnpm` isn't found, that shim is the reason to check.
- **Supply-chain build gate:** dependency build/postinstall scripts are blocked by default and must be allow-listed under `allowBuilds:` in `pnpm-workspace.yaml`. Currently approved: `esbuild`, `msgpackr-extract`, `protobufjs`, `@google/genai`. If a new dep needs a build step, add it there deliberately.
- Copy `.env.example` to `.env` (in `apps/api`, since `config.ts` uses `dotenv/config`). Required at runtime once the pipeline lands: `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, plus `AMAZON_AFFILIATE_TAG`. `REDIS_URL` defaults to `redis://127.0.0.1:6379` — **B1.2 onward needs a local Redis running**.

## Code conventions

- **ESM everywhere.** `apps/api` is `"type": "module"` with TS `module`/`moduleResolution: NodeNext`. **Relative imports must use the `.js` extension** (e.g. `import { config } from './config.js'`) even though the source file is `.ts` — match the existing imports in `src/index.ts`.
- TypeScript is `strict` (inherited from `tsconfig.base.json`); each package extends that base.
- API errors use a consistent envelope: `{ error: { code, message } }` (see the 404 handler). The `ApiError` shape will live in `packages/contract` once created.

## Architecture essentials (target design)

The job lifecycle is **async via polling**, backed by Redis only (no DB, no auth, anonymous):

1. `POST /jobs` — validate body (Zod `CreateJobRequest`: base64 image + mimeType + prompt) → enqueue a BullMQ job → return `202 { jobId }` immediately.
2. **BullMQ worker** (separate process, fail-fast, no retries) runs the pipeline:
   - Model 1 — Gemini Flash-Lite: prompt → enhanced prompt
   - Model 2 — Qwen Image 2.0 via Replicate: input image + enhanced prompt → edited image
   - Model 3 — Gemini Flash-Lite (vision): edited image → up to 5 product key-terms
   - Amazon link builder: each key-term → `https://www.amazon.<TLD>/s?k=<keyterm>&tag=<AFFILIATE_TAG>`
3. `GET /jobs/:id` — map BullMQ state → `JobStatus` (`waiting/delayed`→`queued`, `active`→`processing`, else as-is) and return `result` (when completed) or `error` (when failed). Client polls until terminal.

Finished jobs are evicted from Redis after `JOB_TTL_SECONDS` (default 600s / 10 min). Images travel as **base64 in JSON** (no object storage in phase 1); client resizes to 768px JPEG before encoding; API enforces `MAX_BODY_SIZE` (~10mb). Any model failure → job `failed` with a client-safe message. Exact model IDs are env-configurable (`GEMINI_MODEL`, `REPLICATE_MODEL`) and unset by default.

When implementing, keep the public contract (request/response shapes in `architecture.md` §6) **stable between the stub worker (B1) and the real pipeline (B2)** — that invariant is the whole point of the phased plan.
