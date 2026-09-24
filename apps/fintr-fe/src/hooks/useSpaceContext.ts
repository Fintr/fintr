"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { AxiosInstance } from "axios";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  currentSpaceAtom, 
  availableSpacesAtom, 
  spacePermissionsAtom,
  spaceFeaturesAtom,
  workspaceTransitionAtom 
} from "@/atoms/spaceAtoms";
import { Space, SpaceContext } from "@/types/spaceTypes";
import { spacesApi } from "@/services/spaces/api";
import {
  cacheSpacesList,
  loadCachedSpaceContext,
  loadCachedSpacesList,
} from "@/services/spaces/spaces-list-cache";
import {
  resolveCachedSpacesList,
  resolveCurrentSpace,
  shouldSkipSpacesNetworkFetch,
} from "@/services/spaces/current-space-selection";
import {
  invalidateSpaceSwitchQueries,
  waitForSpaceSwitchReady,
} from "@/utils/invalidateSpaceQueries";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { getUnsyncedSpaceCodes } from "@/lib/local-db/sync-state";
import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import { syncAllWorkspacesLocalData } from "@/services/local-sync/bootstrap-local-data";

export function useSpaceContext(api: AxiosInstance) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const currentSpace = useAtomValue(currentSpaceAtom);
  const setCurrentSpace = useSetAtom(currentSpaceAtom);
  const setAvailableSpaces = useSetAtom(availableSpacesAtom);
  const setSpacePermissions = useSetAtom(spacePermissionsAtom);
  const setSpaceFeatures = useSetAtom(spaceFeaturesAtom);
  
  // Use shared atom for workspace transition state
  const transitionState = useAtomValue(workspaceTransitionAtom);
  const setTransitionState = useSetAtom(workspaceTransitionAtom);

  const localSpacesQuery = useQuery({
    queryKey: ["spaces", "local"],
    queryFn: async () => {
      const loaded = (await loadCachedSpacesList()) ?? null;
      const published = queryClient.getQueryData<Space[] | null>([
        "spaces",
        "local",
      ]);
      return resolveCachedSpacesList({
        loaded,
        published,
      });
    },
    networkMode: "always",
    staleTime: Infinity,
  });

  const cachedSpaces = Array.isArray(localSpacesQuery.data)
    ? localSpacesQuery.data
    : undefined;
  const skipCachedNetwork = useSkipCachedNetworkFetch(localSpacesQuery);
  const skipSpacesNetwork = shouldSkipSpacesNetworkFetch({
    skipCachedNetwork,
    cachedSpaceCount: cachedSpaces?.length ?? 0,
  });

  const { data: networkSpaces, isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces"],
    queryFn: async () => {
      const response = await spacesApi.getSpaces(api);
      const spacesData = response.data.data.spaces ?? [];
      await cacheSpacesList(spacesData);
      queryClient.setQueryData(["spaces", "local"], spacesData);
      setAvailableSpaces(spacesData);
      return spacesData;
    },
    enabled: !skipSpacesNetwork,
    placeholderData: cachedSpaces,
    staleTime: skipSpacesNetwork ? Infinity : 5 * 60 * 1000,
    refetchOnMount: !skipSpacesNetwork,
    refetchOnWindowFocus: !skipSpacesNetwork,
  });

  const spaces = networkSpaces ?? cachedSpaces;

  const localSpaceContextQuery = useQuery({
    queryKey: ["space-context", "local", currentSpace?.code],
    queryFn: async () =>
      currentSpace?.code
        ? ((await loadCachedSpaceContext(currentSpace.code)) ?? null)
        : null,
    enabled: Boolean(currentSpace?.code),
    staleTime: Infinity,
  });

  const skipSpaceContextNetwork = useSkipCachedNetworkFetch(localSpaceContextQuery);

  // Fetch current space details
  const { data: spaceContext, isLoading: contextLoading } = useQuery({
    queryKey: ["space-context", currentSpace?.code],
    queryFn: async (): Promise<SpaceContext> => {
      const response = await spacesApi.getSpace(api, currentSpace?.code || '');
      return response.data.data.space;
    },
    enabled: !!currentSpace?.code && !skipSpaceContextNetwork,
    placeholderData: localSpaceContextQuery.data ?? undefined,
    staleTime: skipSpaceContextNetwork ? Infinity : 2 * 60 * 1000,
    refetchOnMount: !skipSpaceContextNetwork,
  });

  // Update space context when data changes
  useEffect(() => {
    if (spaceContext) {
      setSpacePermissions(spaceContext.permissions);
      setSpaceFeatures(spaceContext.features);
    }
  }, [spaceContext, setSpacePermissions, setSpaceFeatures]);

  // Space switching mutation
  const switchSpaceMutation = useMutation({
    mutationFn: async (spaceCode: string) => {
      try {
        const space = spaces?.find(s => s.code === spaceCode);
        if (!space) {
          throw new Error('Space not found');
        }

        setTransitionState({
          isTransitioning: true,
          destinationSpace: space,
        });

        setCurrentSpace(space);

        if (typeof window !== 'undefined') {
          localStorage.setItem("spaceCode", spaceCode);
          window.dispatchEvent(new CustomEvent('spaceCodeChanged', { detail: { spaceCode } }));
        }

        router.push('/dashboard');

        if (space.hasNewInvitation) {
          try {
            await spacesApi.markSeen(api, spaceCode);
          } catch (error) {
            console.error('Failed to mark invitation as seen:', error);
          }
        }

        // Ensure a newly granted workspace is fully offline-synced before use.
        const unsynced = await getUnsyncedSpaceCodes([spaceCode]);
        if (unsynced.length > 0 && typeof navigator !== "undefined" && navigator.onLine !== false) {
          await syncAllWorkspacesLocalData(
            api,
            queryClient,
            offlineBootstrapDateRange(),
            {
              activeSpaceCode: spaceCode,
              onlySpaceCodes: unsynced,
            },
          );
        }

        await invalidateSpaceSwitchQueries(queryClient);
        await waitForSpaceSwitchReady(queryClient);

        await new Promise(resolve => setTimeout(resolve, 150));

        setTransitionState({
          isTransitioning: false,
          destinationSpace: null,
        });

        return { space };
      } catch (error) {
        setTransitionState({
          isTransitioning: false,
          destinationSpace: null,
        });
        throw error;
      }
    },
  });

  const switchSpace = (spaceCode: string) => {
    switchSpaceMutation.mutate(spaceCode);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !spaces?.length) {
      return;
    }

    const savedSpaceCode = localStorage.getItem("spaceCode");
    const next = resolveCurrentSpace({
      spaces,
      currentSpace,
      savedSpaceCode,
    });

    if (!next) {
      return;
    }

    const defaultTxEqual =
      (next.defaultTransactionCurrency ?? null) ===
      (currentSpace?.defaultTransactionCurrency ?? null);
    const unchanged =
      next.code === currentSpace?.code
      && next.name === currentSpace?.name
      && next.currency === currentSpace?.currency
      && next.userRole === currentSpace?.userRole
      && defaultTxEqual;

    if (!unchanged) {
      setCurrentSpace(next);
    }

    if (savedSpaceCode !== next.code) {
      localStorage.setItem("spaceCode", next.code);
      window.dispatchEvent(
        new CustomEvent("spaceCodeChanged", {
          detail: { spaceCode: next.code },
        }),
      );
    }
  }, [spaces, currentSpace, setCurrentSpace]);

  return {
    spaces,
    currentSpace,
    spaceContext,
    switchSpace,
    isLoading: spacesLoading || contextLoading,
    isSwitching: switchSpaceMutation.isPending,
    transitionState,
  };
}
