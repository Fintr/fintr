import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import {
  seedReactQueryFromLocalCache,
  syncLocalDataFromBackend,
} from "@/services/local-sync/bootstrap-local-data";
import { getCurrentMonthDates } from "@/utils/dateUtils";

/**
 * Currency updates the space. Accounts and skip create accounts, categories,
 * budgets, and opening-balance transactions. Income and budget steps only
 * store the onboarding draft until the accounts step.
 */
export const SETUP_STEPS_THAT_PERSIST_SPACE_DATA = [
  "currency",
  "accounts",
  "skip",
] as const;

export const setupStepPersistsSpaceData = (step: string): boolean =>
  (SETUP_STEPS_THAT_PERSIST_SPACE_DATA as readonly string[]).includes(step);

/**
 * Copies the workspace the backend just created into IndexedDB.
 * The first dashboard visit can bootstrap before setup, which leaves an empty
 * accounts and budgets snapshot. These steps re-import the server rows so the
 * local database matches what setup persisted.
 */
export const cacheWorkspaceSetupInIndexedDb = async (params: {
  api: AxiosInstance;
  queryClient: QueryClient;
  spaceCode: string;
}): Promise<void> => {
  const spaceCode = params.spaceCode.trim();
  if (!spaceCode) {
    console.warn(
      "[onboarding] Skipped IndexedDB setup cache; space code is missing",
    );
    return;
  }

  const bootstrapRange = offlineBootstrapDateRange();
  const { firstDay, lastDay } = getCurrentMonthDates();

  try {
    await syncLocalDataFromBackend(
      params.api,
      params.queryClient,
      {
        spaceCode,
        startDate: bootstrapRange.startDate,
        endDate: bootstrapRange.endDate,
      },
      { deferExchangeRates: true },
    );
    await seedReactQueryFromLocalCache(params.queryClient, {
      spaceCode,
      startDate: firstDay,
      endDate: lastDay,
    });
  } catch (error) {
    console.warn(
      "[onboarding] Failed to cache workspace setup in IndexedDB",
      error,
    );
  }
};
