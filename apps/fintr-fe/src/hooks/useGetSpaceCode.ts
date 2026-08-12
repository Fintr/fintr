"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";
import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useAtomValue, useSetAtom } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import { onboardingStepAtom } from "@/atoms/onboardingAtoms";
import {
  desktopTutorialCompletedAtom,
  mobileTutorialCompletedAtom,
  tutorialDataLoadedAtom,
} from "@/atoms/tutorialAtoms";
import {
  cacheCurrentUserResponse,
  loadCachedCurrentUserResponse,
} from "@/services/auth/local-cache";
import { spacesApi } from "@/services/spaces/api";
import {
  cacheSpacesList,
  loadCachedSpacesList,
} from "@/services/spaces/spaces-list-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { resolveOnboardingStep } from "@/hooks/resolve-onboarding-step";

const getPersistedSpaceCode = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem("spaceCode")?.trim() ?? "";
  } catch {
    return "";
  }
};

type SpacePresence = {
  hasSpace: boolean;
  spaceCode: string;
};

type CurrentUserHandlers = {
  setSpaceCode: (value: string) => void;
  setIsAdmin: (value: boolean) => void;
  setOnboardingStep: (value: string) => void;
  setDesktopTutorialCompleted: (value: boolean) => void;
  setMobileTutorialCompleted: (value: boolean) => void;
  setTutorialDataLoaded: (value: boolean) => void;
};

/**
 * When local workspace hints are missing, verify membership via GET /spaces
 * before routing someone into first-time onboarding.
 */
export const resolveSpacePresence = async (
  api: AxiosInstance,
): Promise<SpacePresence> => {
  const persisted = getPersistedSpaceCode();
  if (persisted) {
    return { hasSpace: true, spaceCode: persisted };
  }

  const cachedSpaces = await loadCachedSpacesList();
  if (cachedSpaces && cachedSpaces.length > 0) {
    return { hasSpace: true, spaceCode: cachedSpaces[0].code };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { hasSpace: false, spaceCode: "" };
  }

  try {
    const response = await spacesApi.getSpaces(api);
    const spaces = response.data.data.spaces ?? [];
    await cacheSpacesList(spaces);

    if (spaces.length > 0) {
      return { hasSpace: true, spaceCode: spaces[0].code };
    }
  } catch (error) {
    console.warn(
      "[useGetSpaceCode] Failed to resolve spaces before onboarding routing",
      error,
    );
  }

  return { hasSpace: false, spaceCode: "" };
};

const shouldVerifySpacesOnNetwork = (): boolean => !getPersistedSpaceCode();

const applyWorkspaceContext = (
  payload: Awaited<ReturnType<typeof loadCachedCurrentUserResponse>> | null,
  spacePresence: SpacePresence,
  handlers: CurrentUserHandlers,
) => {
  const fetchedSpaceCode = payload?.data?.spaceCode;
  const fetchedIsAdmin = payload?.data?.isAdmin;
  const fetchedOnboardingStep = payload?.data?.onboardingStep;
  const fetchedDesktopTutorial = payload?.data?.desktopTutorial;
  const fetchedMobileTutorial = payload?.data?.mobileTutorial;

  const resolvedSpaceCode =
    fetchedSpaceCode || spacePresence.spaceCode || getPersistedSpaceCode();
  const hasSpace = Boolean(resolvedSpaceCode || spacePresence.hasSpace);

  if (resolvedSpaceCode && !getPersistedSpaceCode()) {
    handlers.setSpaceCode(resolvedSpaceCode);
  }
  if (fetchedIsAdmin !== undefined) {
    handlers.setIsAdmin(fetchedIsAdmin);
  }

  handlers.setOnboardingStep(
    resolveOnboardingStep(fetchedOnboardingStep, hasSpace),
  );

  if (fetchedDesktopTutorial !== undefined) {
    handlers.setDesktopTutorialCompleted(fetchedDesktopTutorial);
  }
  if (fetchedMobileTutorial !== undefined) {
    handlers.setMobileTutorialCompleted(fetchedMobileTutorial);
  }

  handlers.setTutorialDataLoaded(true);
};

export function useGetSpaceCode(api: AxiosInstance, isAuthenticated: boolean = false) {
  const isClient = typeof window !== "undefined";
  const [spaceCode, setSpaceCode] = useLocalStorage("spaceCode", "");
  const setIsAdmin = useSetAtom(isAdminAtom);
  const setOnboardingStep = useSetAtom(onboardingStepAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const setDesktopTutorialCompleted = useSetAtom(desktopTutorialCompletedAtom);
  const setMobileTutorialCompleted = useSetAtom(mobileTutorialCompletedAtom);
  const setTutorialDataLoaded = useSetAtom(tutorialDataLoadedAtom);
  const queryEnabled = isClient && isAuthenticated;

  const localCurrentUserQuery = useQuery({
    queryKey: ["currentUser", "local"],
    queryFn: async () => (await loadCachedCurrentUserResponse()) ?? null,
    enabled: queryEnabled,
    staleTime: Infinity,
  });

  const localSpacesQuery = useQuery({
    queryKey: ["spaces", "local"],
    queryFn: async () => (await loadCachedSpacesList()) ?? null,
    enabled: queryEnabled,
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCurrentUserQuery);

  const shouldVerifySpaces =
    queryEnabled && !skipNetworkFetch && shouldVerifySpacesOnNetwork();

  const currentUserQuery = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const verifySpaces = shouldVerifySpacesOnNetwork();
      const [userResult, spacePresence] = await Promise.all([
        api.get("/auth/private"),
        verifySpaces
          ? resolveSpacePresence(api)
          : Promise.resolve({
              hasSpace: Boolean(getPersistedSpaceCode()),
              spaceCode: getPersistedSpaceCode(),
            }),
      ]);

      const payload = userResult.data;

      if (isClient) {
        applyWorkspaceContext(payload, spacePresence, {
          setSpaceCode,
          setIsAdmin,
          setOnboardingStep,
          setDesktopTutorialCompleted,
          setMobileTutorialCompleted,
          setTutorialDataLoaded,
        });
        await cacheCurrentUserResponse(payload);
      }

      return { payload, spacePresence };
    },
    enabled: queryEnabled && !skipNetworkFetch,
    placeholderData: localCurrentUserQuery.data
      ? {
          payload: localCurrentUserQuery.data,
          spacePresence: {
            hasSpace: Boolean(
              localCurrentUserQuery.data.data?.spaceCode
              || localSpacesQuery.data?.length,
            ),
            spaceCode:
              localCurrentUserQuery.data.data?.spaceCode
              || localSpacesQuery.data?.[0]?.code
              || "",
          },
        }
      : undefined,
    staleTime: skipNetworkFetch ? Infinity : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: !skipNetworkFetch,
    retry: (failureCount, error) => {
      const status = (error as AxiosError)?.response?.status;

      if (status === 401 && failureCount < 4) {
        return true;
      }

      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(400 * 2 ** attemptIndex, 2000),
  });

  useEffect(() => {
    if (!localCurrentUserQuery.data || currentUserQuery.data) {
      return;
    }

    const cachedSpaces = localSpacesQuery.data ?? [];
    const spacePresence: SpacePresence = {
      hasSpace: Boolean(
        localCurrentUserQuery.data.data?.spaceCode || cachedSpaces.length > 0,
      ),
      spaceCode:
        localCurrentUserQuery.data.data?.spaceCode
        || cachedSpaces[0]?.code
        || "",
    };

    applyWorkspaceContext(localCurrentUserQuery.data, spacePresence, {
      setSpaceCode,
      setIsAdmin,
      setOnboardingStep,
      setDesktopTutorialCompleted,
      setMobileTutorialCompleted,
      setTutorialDataLoaded,
    });
  }, [
    currentUserQuery.data,
    localCurrentUserQuery.data,
    localSpacesQuery.data,
    setDesktopTutorialCompleted,
    setIsAdmin,
    setMobileTutorialCompleted,
    setOnboardingStep,
    setSpaceCode,
    setTutorialDataLoaded,
  ]);

  useEffect(() => {
    if (!currentUserQuery.isError || onboardingStep !== null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const spacePresence = await resolveSpacePresence(api);

      if (cancelled) {
        return;
      }

      if (spacePresence.hasSpace && spacePresence.spaceCode && !getPersistedSpaceCode()) {
        setSpaceCode(spacePresence.spaceCode);
      }

      setOnboardingStep(resolveOnboardingStep(null, spacePresence.hasSpace));
      setTutorialDataLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    api,
    currentUserQuery.isError,
    onboardingStep,
    setOnboardingStep,
    setSpaceCode,
    setTutorialDataLoaded,
  ]);

  const isVerifyingSpaces =
    shouldVerifySpaces
    && onboardingStep === null
    && (currentUserQuery.isPending || currentUserQuery.isFetching);

  const isResolvingSpaceFallback =
    currentUserQuery.isError && onboardingStep === null;

  const isUserContextResolved =
    currentUserQuery.isSuccess ||
    (localCurrentUserQuery.data != null && skipNetworkFetch) ||
    (currentUserQuery.isError && onboardingStep !== null);
  const isUserContextLoading =
    queryEnabled &&
    !isUserContextResolved &&
    (currentUserQuery.isPending ||
      currentUserQuery.isFetching ||
      localCurrentUserQuery.isPending ||
      localSpacesQuery.isPending ||
      isVerifyingSpaces ||
      isResolvingSpaceFallback);

  return {
    spaceCode,
    onboardingStep,
    isUserContextLoading,
    isVerifyingSpaces,
    refetchUserContext: currentUserQuery.refetch,
  };
}
