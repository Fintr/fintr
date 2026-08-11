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
    queryFn: async () => (await loadCachedSpacesList()) ?? null,
    staleTime: Infinity,
  });

  // Membership + domain reads refresh while online; IndexedDB-only when offline.
  const skipSpacesNetwork = useSkipCachedNetworkFetch(localSpacesQuery);

  // Fetch available spaces
  const { data: spaces, isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces"],
    queryFn: async () => {
      const response = await spacesApi.getSpaces(api);
      const spacesData = response.data.data.spaces;
      await cacheSpacesList(spacesData);
      setAvailableSpaces(spacesData);
      return spacesData;
    },
    enabled: !skipSpacesNetwork,
    placeholderData: localSpacesQuery.data ?? undefined,
    staleTime: skipSpacesNetwork ? Infinity : 5 * 60 * 1000,
    refetchOnMount: !skipSpacesNetwork,
    refetchOnWindowFocus: !skipSpacesNetwork,
  });

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

  // Initialize current space from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && spaces && !currentSpace) {
      const savedSpaceCode = localStorage.getItem("spaceCode");
      if (savedSpaceCode) {
        const space = spaces.find(s => s.code === savedSpaceCode);
        if (space) {
          setCurrentSpace(space);
        } else if (spaces.length > 0) {
          setCurrentSpace(spaces[0]);
          localStorage.setItem("spaceCode", spaces[0].code);
        }
      } else if (spaces.length > 0) {
        setCurrentSpace(spaces[0]);
        localStorage.setItem("spaceCode", spaces[0].code);
      }
    }
  }, [spaces, currentSpace, setCurrentSpace]);

  useEffect(() => {
    if (!spaces?.length || !currentSpace?.code) return;
    const fresh = spaces.find((s) => s.code === currentSpace.code);
    if (!fresh) return;

    const defaultTxEqual =
      (fresh.defaultTransactionCurrency ?? null) ===
      (currentSpace.defaultTransactionCurrency ?? null);

    if (
      fresh.currency !== currentSpace.currency ||
      fresh.name !== currentSpace.name ||
      !defaultTxEqual
    ) {
      setCurrentSpace(fresh);
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
