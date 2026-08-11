import type { SyncBootstrapResponse } from "@/types/syncTypes";

export const verifyBootstrapTotals = (bundle: SyncBootstrapResponse): void => {
  if (bundle.totals.truncated) {
    throw new Error("Bootstrap snapshot was truncated");
  }

  if (bundle.transactions.length !== bundle.totals.transactions) {
    throw new Error(
      `Bootstrap transaction count mismatch: expected ${bundle.totals.transactions}, got ${bundle.transactions.length}`,
    );
  }
};
