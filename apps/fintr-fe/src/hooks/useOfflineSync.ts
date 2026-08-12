"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { toast } from "sonner";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";
import {
  getOfflineSyncMeta,
  shouldRunFullOfflineSync,
} from "@/lib/local-db/sync-state";
import { repairOfflineSpaceCaches } from "@/services/monthly-financial-summaries/local-cache";
import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import {
  refreshOnlineLocalCaches,
  ensureSpaceTransactionIndex,
  seedAllWorkspacesFromLocalCache,
  seedReactQueryFromLocalCache,
  syncAllWorkspacesLocalData,
  syncNewlyAccessibleWorkspaces,
  type OfflineSyncProgress,
} from "@/services/local-sync/bootstrap-local-data";
import { drainAllOutboxes } from "@/services/local-sync/drain-outbox";
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

export const useOfflineSync = (enabled: boolean = true): UseOfflineSyncResult => {
  const queryClient = useQueryClient();
  const setOfflineSyncReady = useSetAtom(offlineSyncReadyAtom);
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
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

      const bootstrapRange = offlineBootstrapDateRange();
      const { firstDay, lastDay } = getCurrentMonthDates();
      const uiDateParams = {
        startDate: firstDay,
        endDate: lastDay,
      };

      const needsFullScreen =
        forceFullScreen || (await shouldRunFullOfflineSync());

      if (needsFullScreen) {
        setOfflineSyncReady(false);
        setStatus("syncing");
        setProgress(initialProgress());

        try {
          await syncAllWorkspacesLocalData(
            api,
            queryClient,
            bootstrapRange,
            {
              activeSpaceCode: spaceCode || undefined,
              onProgress: setProgress,
              onTierReady: (tier) => {
                if (tier === 1 && runId === runIdRef.current) {
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
            await seedReactQueryFromLocalCache(queryClient, {
              spaceCode,
              ...uiDateParams,
            });
          }

          if (runId !== runIdRef.current) {
            return;
          }

          setOfflineSyncReady(true);
          setStatus("complete");

          if (isSpaceSyncPullEnabled()) {
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
            void drainAllOutboxes({ api }).catch((drainError) => {
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
        }

        setOfflineSyncReady(true);
        setStatus("complete");

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
                setOfflineSyncReady(false);
                setStatus("syncing");
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
            void drainAllOutboxes({ api }).catch((drainError) => {
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
      setOfflineSyncReady,
      spaceCode,
    ],
  );

  useEffect(() => {
    if (!enabled || !isAuthenticated || !api) {
      setStatus("idle");
      return;
    }

    setStatus("idle");

    void runSync(false);
  }, [api, enabled, isAuthenticated, runSync]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSpaceChange = () => {
      const { firstDay, lastDay } = getCurrentMonthDates();
      void seedReactQueryFromLocalCache(queryClient, {
        spaceCode: localStorage.getItem("spaceCode") ?? "",
        startDate: firstDay,
        endDate: lastDay,
      });
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

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!isBrowserOnline()) return;
      const code = localStorage.getItem("spaceCode") ?? "";
      if (!code || !api || !isAuthenticated) return;
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

    window.addEventListener("spaceCodeChanged", handleSpaceChange);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("spaceCodeChanged", handleSpaceChange);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
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

  const isBlocking = status === "syncing" || status === "error";

  return {
    status,
    progress,
    error,
    retry,
    isBlocking,
  };
};
