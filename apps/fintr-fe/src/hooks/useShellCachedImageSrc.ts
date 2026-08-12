import { useEffect, useState } from "react";
import { resolveShellCachedAssetObjectUrl } from "@/lib/insights/resolve-shell-cached-asset";

/**
 * Prefer a blob URL from the fintr shell Cache Storage so insight illustrations
 * work offline even when the service worker fetch handler misses a bucket.
 */
export const useShellCachedImageSrc = (
  networkPath: string | null,
): {
  src: string | null;
  fromCache: boolean;
} => {
  const [src, setSrc] = useState<string | null>(networkPath);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!networkPath) {
      setSrc(null);
      setFromCache(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    setSrc(networkPath);
    setFromCache(false);

    void (async () => {
      const cachedObjectUrl = await resolveShellCachedAssetObjectUrl(networkPath);

      if (cancelled) {
        if (cachedObjectUrl) {
          URL.revokeObjectURL(cachedObjectUrl);
        }
        return;
      }

      if (cachedObjectUrl) {
        objectUrl = cachedObjectUrl;
        setSrc(cachedObjectUrl);
        setFromCache(true);
      }
    })();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [networkPath]);

  return { src, fromCache };
};
