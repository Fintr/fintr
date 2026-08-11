import {
  getAccountsSyncedAt,
  listSpaceAccounts,
  putLocalResponseSnapshot,
  replaceSpaceAccounts,
} from "@/lib/local-db";
import { getLocalResponseSnapshot } from "@/lib/local-db/response-cache";
import type { Account } from "@/types/accountTypes";

/**
 * Normalize the various shapes returned by GET /transactions/accounts.
 */
export const extractAccountsFromResponse = (response: unknown): Account[] => {
  if (!response || typeof response !== "object") {
    return [];
  }

  const payload = response as Record<string, unknown>;
  const data = payload.data as Record<string, unknown> | unknown[] | undefined;

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray((data as { accounts?: unknown }).accounts)
  ) {
    return (data as { accounts: Account[] }).accounts;
  }

  if (Array.isArray(payload.accounts)) {
    return payload.accounts as Account[];
  }

  if (Array.isArray(data)) {
    return data as Account[];
  }

  if (Array.isArray(response)) {
    return response as Account[];
  }

  return [];
};

export const cacheAccountsResponse = async (
  spaceId: string,
  response: unknown
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  try {
    const accounts = extractAccountsFromResponse(response);
    await replaceSpaceAccounts(spaceId, accounts);
    await putLocalResponseSnapshot(`accountsResponse:${spaceId}`, response);
  } catch (error) {
    console.warn("[local-db] Failed to cache accounts response", error);
  }
};

/**
 * Rebuild a React Query–friendly payload from IndexedDB.
 * Prefers the full cached API response; falls back to accounts rows only.
 */
export const loadCachedAccountsResponse = async (
  spaceId: string
): Promise<unknown | undefined> => {
  if (!spaceId) {
    return undefined;
  }

  try {
    const snapshot = await getLocalResponseSnapshot(
      `accountsResponse:${spaceId}`
    );
    if (snapshot != null) {
      return snapshot;
    }

    const accounts = await listSpaceAccounts(spaceId);
    if (accounts.length === 0) {
      return undefined;
    }

    const syncedAt = await getAccountsSyncedAt(spaceId);

    return {
      data: {
        accounts,
        cachedAt: syncedAt,
        fromLocalCache: true,
      },
    };
  } catch (error) {
    console.warn("[local-db] Failed to load cached accounts", error);
    return undefined;
  }
};
