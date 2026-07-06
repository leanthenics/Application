import {
  CreateJobResponse,
  GetJobResponse,
  type CreateJobRequest,
} from '@clickretina/contract';

/**
 * API base URL. Set EXPO_PUBLIC_API_BASE_URL in apps/mobile/.env:
 *   - physical phone (Expo Go): your machine's LAN IP, e.g. http://192.168.1.42:54321
 *   - Android emulator: http://10.0.2.2:54321 (the emulator's alias for the host)
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:54321';

/** Error carrying the API's client-safe code + message (from the { error } envelope). */
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function throwApiError(res: Response): Promise<never> {
  let code = 'http_error';
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    if (body?.error?.message) {
      code = body.error.code ?? code;
      message = body.error.message;
    }
  } catch {
    // non-JSON body — keep the generic message
  }
  throw new ApiError(code, message);
}

/** POST /jobs — enqueue a job, returns { jobId }. */
export async function createJob(body: CreateJobRequest): Promise<CreateJobResponse> {
  const res = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res);
  return CreateJobResponse.parse(await res.json());
}

/** GET /jobs/:id — poll a job's status/result. */
export async function getJob(id: string): Promise<GetJobResponse> {
  const res = await fetch(`${BASE_URL}/jobs/${encodeURIComponent(id)}`, { method: 'GET' });
  if (!res.ok) await throwApiError(res);
  return GetJobResponse.parse(await res.json());
}

/** A landing-page showcase card: static before/after images + shoppable products. */
export type ShowcaseProduct = { keyterm: string; amazonUrl: string };
export type ShowcaseItem = {
  id: string;
  title: string;
  beforeUrl: string;
  afterUrl: string;
  products: ShowcaseProduct[];
};

/** Prefix a relative `/showcase/assets/...` path with the API base URL. */
function absolutize(path: unknown): string {
  if (typeof path !== 'string' || !path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * GET /showcase — the static before/after showcase for the landing page. The
 * contract for this endpoint isn't promoted into @clickretina/contract yet
 * (endpoint-first policy), so the response is validated loosely here.
 */
export async function getShowcase(): Promise<ShowcaseItem[]> {
  const res = await fetch(`${BASE_URL}/showcase`, { method: 'GET' });
  if (!res.ok) await throwApiError(res);
  const body = (await res.json()) as { items?: unknown };
  const items = Array.isArray(body.items) ? body.items : [];
  return items
    .map((raw): ShowcaseItem => {
      const it = raw as Record<string, unknown>;
      const products = Array.isArray(it.products) ? it.products : [];
      return {
        id: String(it.id ?? ''),
        title: typeof it.title === 'string' ? it.title : '',
        beforeUrl: absolutize(it.beforeUrl),
        afterUrl: absolutize(it.afterUrl),
        products: products.map((p) => {
          const prod = p as Record<string, unknown>;
          return { keyterm: String(prod.keyterm ?? ''), amazonUrl: String(prod.amazonUrl ?? '') };
        }),
      };
    })
    .filter((it) => it.beforeUrl && it.afterUrl);
}
