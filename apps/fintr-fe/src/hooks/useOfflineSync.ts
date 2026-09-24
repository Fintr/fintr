"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import type { AxiosInstance } from "axios";
import { toast } from "sonner";

import {
  offlineReimportRequiredAtom,
  offlineSyncReadyAtom,
} from "@/atoms/offlineSyncAtoms";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";
import {
  getOfflineSyncMeta,
  resolveOfflineSyncBootstrapState,
} from "@/lib/local-db/sync-state";
import { repairOfflineSpaceCaches } from "@/services/monthly-financial-summaries/local-cache";
import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import {
  refreshOnlineLocalCaches,
  ensureSpaceTransactionIndex,
  resyncTransactionRelationIdsIfNeeded,
  seedAllWorkspacesFromLocalCache,
  seedReactQueryFromLocalCache,
  syncAllWorkspacesLocalData,
  syncNewlyAccessibleWorkspaces,
  type OfflineSyncProgress,
} from "@/services/local-sync/bootstrap-local-data";
import { drainAllOutboxes } from "@/services/local-sync/drain-outbox";
import { catchUpMonthlyBudgetsLocalFirst } from "@/services/budgets/ensure-monthly-budgets-local-first";
import { hydrateBudgetsFromServer } from "@/services/budgets/hydrate-from-server";
import { refreshSpaceExchangeRatesFromCache } from "@/services/exchangeRates/prefetch-space-rates";
import {
  resolveAccessibleSpaceCodes,
  schedulePullAllSpaces,
  schedulePullForSpace,
  startPeriodicPull,
  stopPeriodicPull,
  subscribeSyncBroadcast,
} from "@/services/local-sync/sync-coordinator";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { subscribeCapacitorAppResume } from "@/lib/capacitor-app-resume";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export type OfflineSyncStatus =
  | "idle"
  | "checking"
  | "syncing"
  | "complete"
  | "error";

export type UseOfflineSyncResult = {
  status: OfflineSyncStatus;
  progress: OfflineSyncProgress;
  error: Error | null;
  retry: () => void;
  isBlocking: boolean;
};

const initialProgress = (): OfflineSyncProgress => ({
  phase: "preparing",
  overallProgress: 0,
  completedSpaces: 0,
  totalSpaces: 0,
  spaceProgress: 0,
  detailMessage: "Preparing offline sync…",
});

const isBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const catchUpMonthlyBudgetsForSpace = (
  api: AxiosInstance | null | undefined,
  queryClient: QueryClient,
  spaceCode: string,
): Promise<unknown> => {
  if (!api || !spaceCode) {
    return Promise.resolve();
  }

  const hydrateThenCatchUp = async () => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      await hydrateBudgetsFromServer(
        api,
        { spaceCode },
        { queryClient },
      );
    }

    await catchUpMonthlyBudgetsLocalFirst(
      api,
      { spaceCode },
      { queryClient, waitForSync: false },
    );
  };

  return hydrateThenCatchUp().catch((error) => {
    console.warn("[budgets] Monthly budget catch-up failed", error);
  });
};

export const useOfflineSync = (enabled: boolean = true): UseOfflineSyncResult => {
  const queryClient = useQueryClient();
  const setOfflineSyncReady = useSetAtom(offlineSyncReadyAtom);
  const setOfflineReimportRequired = useSetAtom(offlineReimportRequiredAtom);
  const requiresOfflineReimport = useAtomValue(offlineReimportRequiredAtom);
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users read:budgets",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const [status, setStatus] = useState<OfflineSyncStatus>("idle");
  const [progress, setProgress] = useState<OfflineSyncProgress>(initialProgress);
  const [error, setError] = useState<Error | null>(null);
  const runIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastOnlineRefreshAtRef = useRef(0);

  const runSync = useCallback(
    async (forceFullScreen: boolean) => {
      if (!api || !isAuthenticated) {
        return;
      }

      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setError(null);
      setStatus("checking");

      const bootstrapRange = offlineBootstrapDateRange();
      const { firstDay, lastDay } = getCurrentMonthDates();
      const uiDateParams = {
        startDate: firstDay,
        endDate: lastDay,
      };

      const bootstrapState = await resolveOfflineSyncBootstrapState(
        spaceCode || undefined,
      );
      setOfflineReimportRequired(bootstrapState.requiresReimport);

      const needsFullScreen =
        forceFullScreen || bootstrapState.requiresReimport;
      const shouldBlockUi = needsFullScreen;

      if (needsFullScreen) {
        if (shouldBlockUi) {
          setOfflineSyncReady(false);
          setStatus("syncing");
          setProgress(initialProgress());
        }

        try {
          await syncAllWorkspacesLocalData(
            api,
            queryClient,
            bootstrapRange,
            {
              activeSpaceCode: spaceCode || undefined,
              onProgress: setProgress,
              onTierReady: (tier) => {
                if (
                  tier === 1 &&
                  runId === runIdRef.current &&
                  !bootstrapState.requiresReimport
                ) {
                  setOfflineSyncReady(true);
                }
              },
            },
          );

          const syncMeta = await getOfflineSyncMeta();
          if (syncMeta?.spaceCodes?.length) {
            await repairOfflineSpaceCaches(
              api,
              queryClient,
              syncMeta.spaceCodes,
            );
          }

          if (spaceCode) {
            void resyncTransactionRelationIdsIfNeeded(
              api,
              queryClient,
              syncMeta?.spaceCodes ?? [spaceCode],
            ).catch((resyncError) => {
              console.warn(
                "[offline-sync] Transaction relation-id resync after full sync failed",
                resyncError,
              );
            });
          }

          if (spaceCode) {
            await seedReactQueryFromLocalCache(queryClient, {
              spaceCode,
              ...uiDateParams,
            });
          }

          if (runId !== runIdRef.current) {
            return;
          }

          const verifiedState = await resolveOfflineSyncBootstrapState(
            spaceCode || undefined,
          );
          if (verifiedState.requiresReimport) {
            setStatus("error");
            setError(
              new Error(
                "Offline data could not be loaded completely. Please try again.",
              ),
            );
            return;
          }

          setOfflineSyncReady(true);
          setOfflineReimportRequired(false);
          setStatus("complete");

          if (isSpaceSyncPullEnabled()) {
            catchUpMonthlyBudgetsForSpace(api, queryClient, spaceCode);
            const spaceCodes = await resolveAccessibleSpaceCodes(spaceCode || undefined);
            await schedulePullAllSpaces(
              { api, queryClient, spaceCodes },
              "launch",
            );
          } else {
            if (spaceCode) {
              void ensureSpaceTransactionIndex(api, spaceCode).catch((hydrateError) => {
                console.warn(
                  "[offline-sync] Transaction index hydration after full sync failed",
                  hydrateError,
                );
              });
            }
            void catchUpMonthlyBudgetsForSpace(api, queryClient, spaceCode)
              .then(() => drainAllOutboxes({ api }))
              .catch((drainError) => {
                console.warn("[outbox] Drain after offline sync failed", drainError);
              });
          }
        } catch (syncError) {
          if (runId !== runIdRef.current) {
            return;
          }

          setStatus("error");
          setError(
            syncError instanceof Error
              ? syncError
              : new Error("Offline sync failed"),
          );
        } finally {
          inFlightRef.current = false;
        }
        return;
      }

      // Already synced this version — seed from cache, then pull peer changes while online.
      try {
        await seedAllWorkspacesFromLocalCache(queryClient, uiDateParams);
        if (spaceCode) {
          await seedReactQueryFromLocalCache(queryClient, {
            spaceCode,
            ...uiDateParams,
          });
        }

        if (isBrowserOnline()) {
          const syncMeta = await getOfflineSyncMeta();
          if (syncMeta?.spaceCodes?.length) {
            await repairOfflineSpaceCaches(
              api,
              queryClient,
              syncMeta.spaceCodes,
            );
          }

          if (spaceCode) {
            void resyncTransactionRelationIdsIfNeeded(
              api,
              queryClient,
              syncMeta?.spaceCodes ?? [spaceCode],
            ).catch((resyncError) => {
              console.warn(
                "[offline-sync] Transaction relation-id resync failed",
                resyncError,
              );
            });
          }
        }

        setOfflineSyncReady(true);
        setOfflineReimportRequired(false);
        setStatus("complete");
        const catchUpPromise = catchUpMonthlyBudgetsForSpace(
          api,
          queryClient,
          spaceCode,
        );

        if (spaceCode) {
          void ensureSpaceTransactionIndex(api, spaceCode).catch((hydrateError) => {
            console.warn(
              "[offline-sync] Transaction index hydration after seed failed",
              hydrateError,
            );
          });
        }

        if (isBrowserOnline()) {
          const newSpacesResult = await syncNewlyAccessibleWorkspaces(
            api,
            queryClient,
            bootstrapRange,
            {
              activeSpaceCode: spaceCode || undefined,
              onProgress: (next) => {
                setProgress(next);
              },
            },
          );

          if (runId !== runIdRef.current) {
            return;
          }

          if (newSpacesResult && newSpacesResult.syncedSpaceCodes.length > 0) {
            if (spaceCode) {
              await seedReactQueryFromLocalCache(queryClient, {
                spaceCode,
                ...uiDateParams,
              });
            }
            setProgress((prev) => ({
              ...prev,
              detailMessage: "New workspace data ready.",
            }));
          }

          setOfflineSyncReady(true);
          setStatus("complete");

          if (isSpaceSyncPullEnabled()) {
            const spaceCodes = await resolveAccessibleSpaceCodes(spaceCode || undefined);
            await schedulePullAllSpaces(
              { api, queryClient, spaceCodes },
              "online",
            );
          } else {
            void catchUpPromise
              .then(() => drainAllOutboxes({ api }))
              .catch((drainError) => {
                console.warn("[outbox] Drain after local seed failed", drainError);
              });
          }
        } else {
          setOfflineSyncReady(true);
          setStatus("complete");
        }
      } catch (syncError) {
        if (runId !== runIdRef.current) {
          return;
        }

        // Cache seed succeeded earlier; keep offline-ready and surface soft failure.
        console.warn("[offline-sync] New workspace sync failed", syncError);
        setOfflineSyncReady(true);
        setStatus("complete");
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      api,
      isAuthenticated,
      queryClient,
      setOfflineReimportRequired,
      setOfflineSyncReady,
      spaceCode,
    ],
  );

  useEffect(() => {
    if (!enabled || !isAuthenticated || !api) {
      return;
    }

    void runSync(false);
  }, [api, enabled, isAuthenticated, runSync]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSpaceChange = () => {
      const nextSpaceCode = localStorage.getItem("spaceCode") ?? "";
      const { firstDay, lastDay } = getCurrentMonthDates();
      void seedReactQueryFromLocalCache(queryClient, {
        spaceCode: nextSpaceCode,
        startDate: firstDay,
        endDate: lastDay,
      });
      catchUpMonthlyBudgetsForSpace(api, queryClient, nextSpaceCode);
    };

    const handleOnline = () => {
      if (!api || !isAuthenticated) {
        return;
      }

      toast.message("Back online. Syncing your data…");
      const code = localStorage.getItem("spaceCode") ?? "";
      if (code) {
        void refreshSpaceExchangeRatesFromCache(api, code, { force: true }).catch(
          (refreshError) => {
            console.warn("[exchange-rates] Online refresh failed", refreshError);
          },
        );
      }

      // Push pending outbox rows immediately — do not wait for throttled pull.
      void drainAllOutboxes({ api })
        .catch((drainError) => {
          console.warn("[outbox] Drain on reconnect failed", drainError);
        })
        .finally(() => {
          void runSync(false);
        });
    };

    const handleForegroundRefresh = () => {
      const code = localStorage.getItem("spaceCode") ?? "";
      if (!code || !api || !isAuthenticated) return;

      catchUpMonthlyBudgetsForSpace(api, queryClient, code);

      if (!isBrowserOnline()) return;
      if (Date.now() - lastOnlineRefreshAtRef.current < 30_000) return;
      lastOnlineRefreshAtRef.current = Date.now();

      if (isSpaceSyncPullEnabled()) {
        void schedulePullForSpace(
          { api, queryClient, spaceCodes: [code] },
          code,
          "focus",
        ).catch((refreshError) => {
          console.warn("[offline-sync] Focus pull failed", refreshError);
        });
        void refreshSpaceExchangeRatesFromCache(api, code, { force: false }).catch(
          (refreshError) => {
            console.warn("[exchange-rates] Focus refresh failed", refreshError);
          },
        );
        return;
      }

      void refreshSpaceExchangeRatesFromCache(api, code, { force: false }).catch(
        (refreshError) => {
          console.warn("[exchange-rates] Focus refresh failed", refreshError);
        },
      );

      const { firstDay, lastDay } = getCurrentMonthDates();
      void refreshOnlineLocalCaches(api, queryClient, {
        spaceCode: code,
        startDate: firstDay,
        endDate: lastDay,
      }).catch((refreshError) => {
        console.warn(
          "[offline-sync] Visibility cache refresh failed",
          refreshError,
        );
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      handleForegroundRefresh();
    };

    window.addEventListener("spaceCodeChanged", handleSpaceChange);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribeCapacitorResume = subscribeCapacitorAppResume(
      handleForegroundRefresh,
    );
    return () => {
      window.removeEventListener("spaceCodeChanged", handleSpaceChange);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribeCapacitorResume();
    };
  }, [api, isAuthenticated, queryClient, runSync]);

  useEffect(() => {
    if (!isSpaceSyncPullEnabled() || !api || !isAuthenticated) {
      stopPeriodicPull();
      return;
    }

    let cancelled = false;

    const start = async () => {
      const spaceCodes = await resolveAccessibleSpaceCodes(spaceCode || undefined);
      if (cancelled) {
        return;
      }

      startPeriodicPull({ api, queryClient, spaceCodes });
    };

    void start();

    const unsubscribeBroadcast = subscribeSyncBroadcast(() => {
      // Other tabs completed a pull; no action required beyond dedupe state.
    });

    return () => {
      cancelled = true;
      stopPeriodicPull();
      unsubscribeBroadcast();
    };
  }, [api, isAuthenticated, queryClient, spaceCode]);

  const retry = useCallback(() => {
    void runSync(true);
  }, [runSync]);

  const isBlocking =
    requiresOfflineReimport &&
    status !== "complete";

  return {
    status,
    progress,
    error,
    retry,
    isBlocking,
  };
};
