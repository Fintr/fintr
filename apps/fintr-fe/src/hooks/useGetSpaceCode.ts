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

const normalizeOnboardingStep = (step: unknown) => {
  if (step && String(step).trim()) {
    return String(step).trim();
  }

  return "currency";
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

  const currentUserQuery = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      const fetchedSpaceCode = response.data?.data?.spaceCode;
      const fetchedIsAdmin = response.data?.data?.isAdmin;
      const fetchedOnboardingStep = response.data?.data?.onboardingStep;
      const fetchedDesktopTutorial = response.data?.data?.desktopTutorial;
      const fetchedMobileTutorial = response.data?.data?.mobileTutorial;

      if (isClient) {
        if (fetchedSpaceCode && !spaceCode) {
          setSpaceCode(fetchedSpaceCode);
        }
        if (fetchedIsAdmin !== undefined) {
          setIsAdmin(fetchedIsAdmin);
        }

        setOnboardingStep(normalizeOnboardingStep(fetchedOnboardingStep));

        if (fetchedDesktopTutorial !== undefined) {
          setDesktopTutorialCompleted(fetchedDesktopTutorial);
        }
        if (fetchedMobileTutorial !== undefined) {
          setMobileTutorialCompleted(fetchedMobileTutorial);
        }

        setTutorialDataLoaded(true);
      }

      return response.data;
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
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
    (currentUserQuery.isError && onboardingStep !== null);
  const isUserContextLoading =
    queryEnabled &&
    !isUserContextResolved &&
    (currentUserQuery.isLoading || currentUserQuery.isFetching);

  return {
    spaceCode,
    onboardingStep,
    isUserContextLoading,
    refetchUserContext: currentUserQuery.refetch,
  };
}
