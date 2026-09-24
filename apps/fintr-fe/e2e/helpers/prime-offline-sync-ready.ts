import type { Page } from "@playwright/test";

import { OFFLINE_SYNC_VERSION } from "../../src/lib/local-db/sync-state";

export async function primeOfflineSyncReady(page: Page): Promise<void> {
  await page.addInitScript((version: number) => {
    window.localStorage.setItem(
      "fintr:offlineSyncReadyVersion",
      String(version),
    );
  }, OFFLINE_SYNC_VERSION);
}

/** Hydrates the offline-ready localStorage hint used on app boot. */
export async function primeOfflineSyncComplete(
  page: Page,
): Promise<void> {
  await primeOfflineSyncReady(page);
}
