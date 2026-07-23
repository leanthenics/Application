import { useEffect, useState } from 'react';
import { getSignedImageUrl } from '@/lib/storage';

/**
 * Resolve a private Storage object path (e.g. `JobResult.outputImagePath`) to a
 * short-lived signed URL for rendering. Returns null while resolving or on
 * failure. Re-resolves when `path` changes; guards against setting state after
 * unmount / a stale path.
 */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let active = true;
    setUrl(null);
    void getSignedImageUrl(path).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
