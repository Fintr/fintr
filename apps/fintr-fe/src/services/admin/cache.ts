const BASE = process.env.NEXT_PUBLIC_BE_URL;

export interface CacheVersionResponse {
  success: boolean;
  data: {
    cacheVersion: string;
    updatedAt: string | null;
  };
}

export interface ClearCacheResponse {
  success: boolean;
  message: string;
  data: {
    cacheVersion: string;
    updatedAt: string;
  };
}

/**
 * Fetch current cache version (admin endpoint, requires auth).
 */
export async function getAdminCacheVersion(
  getToken: () => Promise<string>
): Promise<CacheVersionResponse["data"]> {
  const token = await getToken();
  const res = await fetch(`${BASE}/api/v1/admin/cache`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch cache version");
  const json = (await res.json()) as CacheVersionResponse;
  return json.data;
}

/**
 * Clear app cache and bump version (admin only).
 * All iOS/Android apps will refresh on next load or when they check version.
 */
export async function clearAppCache(
  getToken: () => Promise<string>
): Promise<ClearCacheResponse["data"]> {
  const token = await getToken();
  const res = await fetch(`${BASE}/api/v1/admin/cache/clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to clear cache");
  const json = (await res.json()) as ClearCacheResponse;
  return json.data;
}

/**
 * Public endpoint: current cache version (no auth).
 * Used by mobile app to decide whether to clear cache and reload.
 */
export async function getPublicCacheVersion(): Promise<{
  cacheVersion: string;
  updatedAt: string | null;
}> {
  const res = await fetch(`${BASE}/api/v1/cache_version`);
  if (!res.ok) throw new Error("Failed to fetch cache version");
  const json = (await res.json()) as { success: boolean; data: { cacheVersion: string; updatedAt: string | null } };
  return json.data;
}
