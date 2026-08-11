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
import { loadCachedCurrentUserResponse } from "@/services/auth/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";

const normalizeOnboardingStep = (step: unknown) => {
  if (step && String(step).trim()) {
    return String(step).trim();
  }

  return "currency";
};

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

const applyCurrentUserPayload = (
  payload: Awaited<ReturnType<typeof loadCachedCurrentUserResponse>>,
  handlers: {
    setSpaceCode: (value: string) => void;
    setIsAdmin: (value: boolean) => void;
    setOnboardingStep: (value: string) => void;
    setDesktopTutorialCompleted: (value: boolean) => void;
    setMobileTutorialCompleted: (value: boolean) => void;
    setTutorialDataLoaded: (value: boolean) => void;
  },
) => {
  const fetchedSpaceCode = payload?.data?.spaceCode;
  const fetchedIsAdmin = payload?.data?.isAdmin;
  const fetchedOnboardingStep = payload?.data?.onboardingStep;
  const fetchedDesktopTutorial = payload?.data?.desktopTutorial;
  const fetchedMobileTutorial = payload?.data?.mobileTutorial;

  // /auth/private always returns the personal space. Prefer the last-touched
  // workspace already persisted locally (e.g. a guest space) on reload.
  if (fetchedSpaceCode && !getPersistedSpaceCode()) {
    handlers.setSpaceCode(fetchedSpaceCode);
  }
  if (fetchedIsAdmin !== undefined) {
    handlers.setIsAdmin(fetchedIsAdmin);
  }

  handlers.setOnboardingStep(normalizeOnboardingStep(fetchedOnboardingStep));

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
  const isAdmin = useAtomValue(isAdminAtom);
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

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCurrentUserQuery);

  const currentUserQuery = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      const payload = response.data;

      if (isClient) {
        applyCurrentUserPayload(payload, {
          setSpaceCode,
          setIsAdmin,
          setOnboardingStep,
          setDesktopTutorialCompleted,
          setMobileTutorialCompleted,
          setTutorialDataLoaded,
        });
      }

      return payload;
    },
    enabled: queryEnabled && !skipNetworkFetch,
    placeholderData: localCurrentUserQuery.data ?? undefined,
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

    applyCurrentUserPayload(localCurrentUserQuery.data, {
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

    const fallbackStep = spaceCode ? "completed" : "currency";
    setOnboardingStep(fallbackStep);
    setTutorialDataLoaded(true);
  }, [
    currentUserQuery.isError,
    onboardingStep,
    setOnboardingStep,
    setTutorialDataLoaded,
    spaceCode,
  ]);

  const isUserContextResolved =
    currentUserQuery.isSuccess ||
    (localCurrentUserQuery.data != null && skipNetworkFetch) ||
    (currentUserQuery.isError && onboardingStep !== null);
  const isUserContextLoading =
    queryEnabled &&
    !isUserContextResolved &&
    (currentUserQuery.isPending ||
      currentUserQuery.isFetching ||
      localCurrentUserQuery.isPending);

  return {
    spaceCode,
    onboardingStep,
    isUserContextLoading,
    refetchUserContext: currentUserQuery.refetch,
  };
}
