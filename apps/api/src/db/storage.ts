import type { ImageMime, OutputImageMime } from '@clickretina/contract';
import { config } from '../config.js';
import { getServiceClient } from './supabase.js';

/**
 * Supabase Storage access for job images — SERVER ONLY (service-role, bypasses RLS).
 *
 * Images live in the private `job-images` bucket under `<userId>/<jobId>/<kind>.<ext>`.
 * The worker uploads here after a successful pipeline; the DB (public.generations) keeps
 * only the returned path. Clients read via short-lived signed URLs they mint themselves
 * (storage RLS = own folder). Objects are purged by the cleanup job at retention time —
 * deletion MUST go through the Storage API (`remove`), never raw SQL (that orphans the
 * object). See docs/private/sql/generations.sql.
 */

export type ImageKind = 'input' | 'output';

/** File extension for a stored image, derived from its content-type. */
function extForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

/** Deterministic object path: `<userId>/<jobId>/<kind>.<ext>`. */
export function imagePath(
  userId: string,
  jobId: string,
  kind: ImageKind,
  mimeType: string,
): string {
  return `${userId}/${jobId}/${kind}.${extForMime(mimeType)}`;
}

/** Upload one base64 image; returns the stored object path. `upsert` so retries overwrite. */
export async function uploadImage(
  userId: string,
  jobId: string,
  kind: ImageKind,
  base64: string,
  mimeType: ImageMime | OutputImageMime,
): Promise<string> {
  const path = imagePath(userId, jobId, kind, mimeType);
  const { error } = await getServiceClient()
    .storage.from(config.storage.bucket)
    .upload(path, Buffer.from(base64, 'base64'), { contentType: mimeType, upsert: true });
  if (error) throw new Error(`storage upload failed (${kind}): ${error.message}`);
  return path;
}

/** Delete objects by path (no-op on empty). Used by the retention cleanup job. */
export async function removeImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getServiceClient().storage.from(config.storage.bucket).remove(paths);
  if (error) throw new Error(`storage remove failed: ${error.message}`);
}
