import { supabase } from './supabase';

/**
 * Job-image reads. Since the storage migration (2026-07-18) the API returns
 * Storage object PATHS in `JobResult` (`inputImagePath` / `outputImagePath`),
 * not base64 bytes. The images live in the PRIVATE `job-images` bucket, so the
 * client mints a short-lived signed URL per view via its authed Supabase client
 * (storage RLS = read own folder: `<userId>/<jobId>/...`).
 */

const BUCKET = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'job-images';
/** Signed-URL lifetime. Long enough to view + compare; expo-image caches by URL. */
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Resolve a Storage object path to a temporary signed URL. Returns null (and logs)
 * on failure — e.g. the object was purged past retention, or storage RLS/bucket
 * isn't set up yet — so callers can fall back gracefully instead of crashing.
 */
export async function getSignedImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('[storage] createSignedUrl failed:', error.message);
    return null;
  }
  return data.signedUrl;
}
