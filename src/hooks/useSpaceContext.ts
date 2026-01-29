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

  // Fetch available spaces
  const { data: spaces, isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces"],
    queryFn: async () => {
      const response = await spacesApi.getSpaces(api);
      const spacesData = response.data.data.spaces;
      setAvailableSpaces(spacesData);
      return spacesData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current space details
  const { data: spaceContext, isLoading: contextLoading } = useQuery({
    queryKey: ["space-context", currentSpace?.code],
    queryFn: async (): Promise<SpaceContext> => {
      const response = await spacesApi.getSpace(api, currentSpace?.code || '');
      return response.data.data.space;
    },
    enabled: !!currentSpace?.code,
    staleTime: 2 * 60 * 1000, // 2 minutes
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
      const space = spaces?.find(s => s.code === spaceCode);
      if (!space) {
        throw new Error('Space not found');
      }

      console.log('🔄 Starting space switch to:', space.name);

      // Show transition screen immediately
      setTransitionState({
        isTransitioning: true,
        destinationSpace: space,
      });

      console.log('🎬 Transition state set, overlay should appear now');

      // Small delay to ensure the slide-in animation starts smoothly
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the current space
      setCurrentSpace(space);
      
      // Update localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem("spaceCode", spaceCode);
        window.dispatchEvent(new CustomEvent('spaceCodeChanged', { detail: { spaceCode } }));
      }

      return { space };
    },
    onSuccess: async (data, spaceCode) => {
      // Invalidate all space-scoped queries when workspace is switched
      queryClient.invalidateQueries({ queryKey: ["space-context"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactionCategories"] });
      queryClient.invalidateQueries({ queryKey: ["transactionDrafts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["spaceUsers"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["ai", "usage"] });

      // Keep showing the transition screen for smooth experience (2.5 seconds total)
      // This ensures users see the full slide-in animation and the pulsating logo
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Navigate to transactions tab
      router.push('/dashboard');

      // Wait a bit before hiding transition screen (allows page to start loading)
      await new Promise(resolve => setTimeout(resolve, 400));

      // Hide transition screen with slide-out animation
      setTransitionState({
        isTransitioning: false,
        destinationSpace: null,
      });
    },
    onError: () => {
      // Hide transition screen on error
      setTransitionState({
        isTransitioning: false,
        destinationSpace: null,
      });
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
          // If saved space not found, default to first space and update localStorage
          setCurrentSpace(spaces[0]);
          localStorage.setItem("spaceCode", spaces[0].code);
        }
      } else if (spaces.length > 0) {
        // Default to first space if no saved preference
        setCurrentSpace(spaces[0]);
        localStorage.setItem("spaceCode", spaces[0].code);
      }
    }
  }, [spaces, currentSpace, setCurrentSpace]);

  return {
    spaces,
    currentSpace,
    spaceContext,
    switchSpace,
    isLoading: spacesLoading || contextLoading,
    isSwitching: switchSpaceMutation.isPending || switchSpaceMutation.isLoading,
    transitionState,
  };
}

