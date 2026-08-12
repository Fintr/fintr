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
    .filter((key) => key.startsWith("fintr-shell-"))
    .sort()
    .reverse();
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
