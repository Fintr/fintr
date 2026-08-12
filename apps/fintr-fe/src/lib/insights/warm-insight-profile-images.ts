import { PROFILE_IMAGE_PATHS } from "@/lib/insights/profile-catalog";
import { listShellCacheNames } from "@/lib/insights/resolve-shell-cached-asset";

const PROFILE_IMAGE_URLS = Object.values(PROFILE_IMAGE_PATHS);

/**
 * Ensures insight profile illustrations are in the fintr shell cache.
 * Call while online (e.g. on Dashboard mount) so offline insight cards
 * can load /profiles/*.png without hitting the network.
 */
export const warmInsightProfileImages = async (): Promise<void> => {
  if (typeof window === "undefined" || !navigator.onLine) {
    return;
  }

  const shellKeys = await listShellCacheNames();
  const cacheName = shellKeys[0];

  if (!cacheName) {
    await Promise.allSettled(
      PROFILE_IMAGE_URLS.map((url) => fetch(url, { cache: "force-cache" })),
    );
    return;
  }

  const cache = await caches.open(cacheName);

  await Promise.allSettled(
    PROFILE_IMAGE_URLS.map(async (url) => {
      const existing = await cache.match(url, { ignoreVary: true });

      if (existing) {
        return;
      }

      const response = await fetch(url);

      if (response.ok) {
        await cache.put(url, response);
      }
    }),
  );
};
