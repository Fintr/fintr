"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { AxiosInstance } from "axios";
import { useEffect } from "react";
import { 
  currentSpaceAtom, 
  availableSpacesAtom, 
  spacePermissionsAtom,
  spaceFeaturesAtom 
} from "@/atoms/spaceAtoms";
import { Space, SpaceContext } from "@/types/spaceTypes";
import { spacesApi } from "@/services/spaces/api";

export function useSpaceContext(api: AxiosInstance) {
  const queryClient = useQueryClient();
  const currentSpace = useAtomValue(currentSpaceAtom);
  const setCurrentSpace = useSetAtom(currentSpaceAtom);
  const setAvailableSpaces = useSetAtom(availableSpacesAtom);
  const setSpacePermissions = useSetAtom(spacePermissionsAtom);
  const setSpaceFeatures = useSetAtom(spaceFeaturesAtom);

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
      // For now, just update the current space in state
      // In a real implementation, this would call the switch API
      const space = spaces?.find(s => s.code === spaceCode);
      if (space) {
        setCurrentSpace(space);
        // Update localStorage for persistence - this will trigger re-renders in components using useLocalStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem("spaceCode", spaceCode);
          // Dispatch a custom event to notify components of the change
          window.dispatchEvent(new CustomEvent('spaceCodeChanged', { detail: { spaceCode } }));
        }
      }
      return { space };
    },
    onSuccess: (data, spaceCode) => {
      // Invalidate all space-scoped queries
      queryClient.invalidateQueries({ queryKey: ["space-context"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactionCategories"] });
      queryClient.invalidateQueries({ queryKey: ["transactionDrafts"] });
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
    isSwitching: switchSpaceMutation.isLoading,
  };
}

