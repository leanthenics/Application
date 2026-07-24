import type { ProductGroup } from '@clickretina/contract';
import { supabase } from './supabase';

/**
 * Persistent generation history (the `public.generations` table). Since the
 * storage migration (2026-07-18) every completed job is recorded there by the
 * worker (service-role), with the input/output images kept as PRIVATE Storage
 * object paths — see lib/storage.ts for path → signed-URL resolution.
 *
 * Reads are RLS-scoped to the caller (auth.uid() = user_id), and the backend
 * cleanup job purges anything past the retention window, so the client can only
 * ever surface the last HISTORY_RETENTION_DAYS days.
 */

/** One persisted generation, camelCased from the snake_case DB row. */
export type Generation = {
  id: string;
  style: string;
  styleLabel: string | null;
  prompt: string | null;
  night: boolean;
  inputPath: string;
  outputPath: string;
  mimeType: string;
  productGroups: ProductGroup[];
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
};

/**
 * How many days of history the backend retains (IMAGE_RETENTION_DAYS, default 4).
 * Drives the History disclaimer copy; kept in sync with the API via env so the
 * UI never promises more than the cleanup job actually keeps.
 */
export const HISTORY_RETENTION_DAYS =
  Number(process.env.EXPO_PUBLIC_IMAGE_RETENTION_DAYS) || 4;

const COLUMNS =
  'id, style, style_label, prompt, night, input_path, output_path, mime_type, product_groups, created_at, expires_at';

type Row = {
  id: string;
  style: string;
  style_label: string | null;
  prompt: string | null;
  night: boolean;
  input_path: string;
  output_path: string;
  mime_type: string;
  product_groups: ProductGroup[] | null;
  created_at: string;
  expires_at: string;
};

function toGeneration(r: Row): Generation {
  return {
    id: r.id,
    style: r.style,
    styleLabel: r.style_label,
    prompt: r.prompt,
    night: r.night,
    inputPath: r.input_path,
    outputPath: r.output_path,
    mimeType: r.mime_type,
    productGroups: r.product_groups ?? [],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

/** The current user's generations, newest first (RLS-scoped to them). */
export async function fetchHistory(): Promise<Generation[]> {
  const { data, error } = await supabase
    .from('generations')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toGeneration);
}

/** A single generation by id — used when the detail screen is opened cold. */
export async function fetchGeneration(id: string): Promise<Generation | null> {
  const { data, error } = await supabase
    .from('generations')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toGeneration(data as Row) : null;
}
