import type { PipelineContext } from './context.js';

/**
 * A single pipeline stage. Steps have heterogeneous input/output types, so the
 * ordered pipeline (see `runner.ts`) composes them explicitly rather than as a
 * generic variadic chain.
 */
export interface PipelineStep<In, Out> {
  /** Short, stable identifier used in structured logs. */
  name: string;
  run(input: In, ctx: PipelineContext): Promise<Out>;
}

/**
 * Run one step with timing + structured logging. Fail-fast: on error we log and
 * rethrow so the BullMQ worker marks the job `failed` (queue has `attempts: 1`).
 *
 * IMPORTANT: never log image/base64 payloads here — only step name, jobId, ms.
 */
export async function runStep<In, Out>(
  step: PipelineStep<In, Out>,
  input: In,
  ctx: PipelineContext,
): Promise<Out> {
  const start = performance.now();
  try {
    const out = await step.run(input, ctx);
    const ms = Math.round(performance.now() - start);
    console.log(`[pipeline] ${ctx.jobId} ${step.name} ok (${ms}ms)`);
    return out;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] ${ctx.jobId} ${step.name} failed (${ms}ms): ${message}`);
    throw err;
  }
}
