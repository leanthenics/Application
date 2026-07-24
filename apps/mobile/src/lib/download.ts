import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/**
 * Save a remote image (a short-lived signed Storage URL) into the device photo
 * library. MediaLibrary can only save a LOCAL file, so we first download the URL
 * to a temp cache file, then create the asset, then clean up the temp file.
 *
 * Returns a small outcome object (rather than throwing) so the caller can show a
 * clear message for the two cases that matter: permission denied vs. failure.
 */
export type SaveResult = { ok: true } | { ok: false; reason: 'permission' | 'error' };

/** Pick a sensible file extension from the output mime type. */
function extFor(mimeType: string | undefined): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function saveImageToGallery(
  url: string,
  opts: { id: string; mimeType?: string },
): Promise<SaveResult> {
  try {
    const { status } = await requestPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'permission' };

    // Unique name so repeat downloads never collide with an existing cache file.
    const name = `clickretina-${opts.id}-${Date.now()}.${extFor(opts.mimeType)}`;
    const destination = new File(Paths.cache, name);
    const file = await File.downloadFileAsync(url, destination);

    await Asset.create(file.uri);

    try {
      file.delete(); // best-effort temp cleanup; ignore if it fails
    } catch {
      // no-op
    }
    return { ok: true };
  } catch (e) {
    console.warn('[download] failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'error' };
  }
}
