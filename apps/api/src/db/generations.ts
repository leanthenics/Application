import type { ProductGroup } from '@clickretina/contract';
import { config } from '../config.js';
import { getServiceClient } from './supabase.js';

/**
 * public.generations — the persistent image-history table (docs/private/sql/generations.sql).
 * SERVER ONLY writes (service-role, bypasses RLS); clients only READ their own rows via RLS.
 * Holds job metadata + Storage object PATHS (not bytes). Rows + their objects are purged by
 * the worker's cleanup job once `expires_at` passes.
 */

/** Row inserted on a successful generation (expires_at is computed from the retention window). */
export interface GenerationRow {
  id: string; // = jobId
  user_id: string;
  style: string;
  style_label: string;
  prompt: string | null;
  night: boolean;
  input_path: string;
  output_path: string;
  mime_type: string;
  product_groups: ProductGroup[];
}

/** Insert one history row, stamping `expires_at = now + retentionDays`. */
export async function recordGeneration(row: GenerationRow): Promise<void> {
  const expiresAt = new Date(
    Date.now() + config.storage.retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await getServiceClient()
    .from('generations')
    .insert({ ...row, expires_at: expiresAt });
  if (error) throw new Error(`recordGeneration failed: ${error.message}`);
}

/** A past-retention row: just enough to delete its objects + itself. */
export interface ExpiredGeneration {
  id: string;
  input_path: string;
  output_path: string;
}

/** Rows whose `expires_at` is in the past, capped at `limit` (the cleanup job drains in batches). */
export async function listExpired(limit = 500): Promise<ExpiredGeneration[]> {
  const { data, error } = await getServiceClient()
    .from('generations')
    .select('id, input_path, output_path')
    .lt('expires_at', new Date().toISOString())
    .limit(limit);
  if (error) throw new Error(`listExpired failed: ${error.message}`);
  return (data ?? []) as ExpiredGeneration[];
}

/** Delete history rows by id (no-op on empty). Call AFTER removing their Storage objects. */
export async function deleteGenerations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getServiceClient().from('generations').delete().in('id', ids);
  if (error) throw new Error(`deleteGenerations failed: ${error.message}`);
}
