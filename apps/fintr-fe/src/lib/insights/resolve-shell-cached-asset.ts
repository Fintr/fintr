const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

export const listShellCacheNames = async (): Promise<string[]> => {
  if (typeof caches === "undefined") {
    return [];
  }

  const keys = await caches.keys();

  return keys
    .filter(
      (key) => key.startsWith("fintr-shell-") || key.startsWith("fintr-dev-"),
    )
    .sort()
    .reverse();
};

export const warmShellCachedImageUrls = async (
  urls: string[],
): Promise<void> => {
  if (typeof window === "undefined" || !navigator.onLine || urls.length === 0) {
    return;
  }

  const shellKeys = await listShellCacheNames();
  const cacheName = shellKeys[0];

  if (!cacheName) {
    await Promise.allSettled(
      urls.map((url) => fetch(url, { cache: "force-cache" })),
    );
    return;
  }

  const cache = await caches.open(cacheName);

  await Promise.allSettled(
    urls.map(async (url) => {
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

/**
 * Read a static shell asset (e.g. /profiles/*.png) from any fintr-shell cache
 * and return an object URL suitable for <img src>.
 */
export const resolveShellCachedAssetObjectUrl = async (
  pathname: string,
): Promise<string | null> => {
  const target = normalizePathname(
    pathname.startsWith("/") ? pathname : `/${pathname}`,
  );

  const shellKeys = await listShellCacheNames();

  for (const shellKey of shellKeys) {
    const cache = await caches.open(shellKey);
    const absoluteUrl = new URL(target, window.location.origin).href;
    const response =
      (await cache.match(target, { ignoreVary: true }))
      ?? (await cache.match(absoluteUrl, { ignoreVary: true }));

    if (!response?.ok) {
      continue;
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      continue;
    }

    return URL.createObjectURL(blob);
  }

  return null;
};

export const findShellCacheNameForAsset = async (
  pathname: string,
): Promise<string | null> => {
  const target = normalizePathname(
    pathname.startsWith("/") ? pathname : `/${pathname}`,
  );

  const shellKeys = await listShellCacheNames();

  for (const shellKey of shellKeys) {
    const cache = await caches.open(shellKey);
    const absoluteUrl = new URL(target, window.location.origin).href;
    const response =
      (await cache.match(target, { ignoreVary: true }))
      ?? (await cache.match(absoluteUrl, { ignoreVary: true }));

    if (response?.ok) {
      return shellKey;
    }
  }

  return null;
};
