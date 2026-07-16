import {
  CreateJobResponse,
  GetJobResponse,
  type CreateJobRequest,
} from '@clickretina/contract';
import { supabase } from '@/lib/supabase';

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

/**
 * Bearer header for the protected /jobs endpoints. Reads the session fresh each
 * call so a background token refresh (autoRefreshToken) is always reflected — a
 * token cached at import time could be stale. No session → no header (server 401s).
 */
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res);
  return CreateJobResponse.parse(await res.json());
}

/** GET /jobs/:id — poll a job's status/result. */
export async function getJob(id: string): Promise<GetJobResponse> {
  const res = await fetch(`${BASE_URL}/jobs/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { ...(await authHeader()) },
  });
  if (!res.ok) await throwApiError(res);
  return GetJobResponse.parse(await res.json());
}

/** A garden style option from the server catalog (GET /styles). */
export type Style = { id: string; label: string; blurb: string; imageUrl: string };

/**
 * GET /styles — the garden style catalog for the picker. Not promoted into
 * @clickretina/contract (endpoint-first policy), so validated loosely here. The
 * preview `imageUrl` may be blank until set on the server; relative paths are
 * absolutized against the API base URL.
 */
export async function getStyles(): Promise<Style[]> {
  const res = await fetch(`${BASE_URL}/styles`, { method: 'GET' });
  if (!res.ok) await throwApiError(res);
  const body = (await res.json()) as { styles?: unknown };
  const styles = Array.isArray(body.styles) ? body.styles : [];
  return styles
    .map((raw): Style => {
      const s = raw as Record<string, unknown>;
      return {
        id: String(s.id ?? ''),
        label: typeof s.label === 'string' ? s.label : '',
        blurb: typeof s.blurb === 'string' ? s.blurb : '',
        imageUrl: absolutize(s.imageUrl),
      };
    })
    .filter((s) => s.id && s.label);
}

/** A purchasable credit pack from the server catalog (GET /credits/packages). */
export type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  price: number;
  currency: string;
};

/**
 * GET /credits/packages — the buyable credit packs. Not promoted into
 * @clickretina/contract (endpoint-first policy), so validated loosely here.
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const res = await fetch(`${BASE_URL}/credits/packages`, {
    method: 'GET',
    headers: { ...(await authHeader()) },
  });
  if (!res.ok) await throwApiError(res);
  const body = (await res.json()) as { packages?: unknown };
  const packages = Array.isArray(body.packages) ? body.packages : [];
  return packages
    .map((raw): CreditPackage => {
      const p = raw as Record<string, unknown>;
      return {
        id: String(p.id ?? ''),
        label: typeof p.label === 'string' ? p.label : '',
        credits: typeof p.credits === 'number' ? p.credits : 0,
        price: typeof p.price === 'number' ? p.price : 0,
        currency: typeof p.currency === 'string' ? p.currency : 'INR',
      };
    })
    .filter((p) => p.id && p.credits > 0);
}

/**
 * POST /credits/purchase — grant a pack's credits (no gateway yet). Returns the new
 * balance. Callers should refreshProfile() afterwards to sync the store.
 */
export async function purchaseCredits(packageId: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/credits/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ packageId }),
  });
  if (!res.ok) await throwApiError(res);
  const body = (await res.json()) as { credits?: unknown };
  return typeof body.credits === 'number' ? body.credits : 0;
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
