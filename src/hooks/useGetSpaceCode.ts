"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { useLocalStorage } from "./useLocalStorage";
import { useAtomValue, useSetAtom } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import { onboardingStepAtom } from "@/atoms/onboardingAtoms";
import { desktopTutorialCompletedAtom, mobileTutorialCompletedAtom, tutorialDataLoadedAtom } from "@/atoms/tutorialAtoms";

export function useGetSpaceCode(api: AxiosInstance, isAuthenticated: boolean = true) {
  const isClient = typeof window !== 'undefined';
  const [spaceCode, setSpaceCode] = useLocalStorage("spaceCode", "");
  const setIsAdmin = useSetAtom(isAdminAtom);
  const isAdmin = useAtomValue(isAdminAtom);
  const setOnboardingStep = useSetAtom(onboardingStepAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const setDesktopTutorialCompleted = useSetAtom(desktopTutorialCompletedAtom);
  const setMobileTutorialCompleted = useSetAtom(mobileTutorialCompletedAtom);
  const setTutorialDataLoaded = useSetAtom(tutorialDataLoadedAtom);

  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      const fetchedSpaceCode = response.data?.data?.spaceCode;
      const fetchedIsAdmin = response.data?.data?.isAdmin;
      const fetchedOnboardingStep = response.data?.data?.onboardingStep;
      const fetchedDesktopTutorial = response.data?.data?.desktopTutorial;
      const fetchedMobileTutorial = response.data?.data?.mobileTutorial;
      if (isClient) {
        // Only update spaceCode if there's no existing value in localStorage
        // This prevents the backend from overriding user's space selection
        if (fetchedSpaceCode && !spaceCode) {
          setSpaceCode(fetchedSpaceCode);
        }
        if (fetchedIsAdmin !== undefined) {
          setIsAdmin(fetchedIsAdmin);
        }
        // Always set onboarding step: treat empty/missing as "currency" so new users start at step1
        const normalizedStep =
          fetchedOnboardingStep && String(fetchedOnboardingStep).trim()
            ? fetchedOnboardingStep
            : "currency";
        setOnboardingStep(normalizedStep);
        if (fetchedDesktopTutorial !== undefined) {
          setDesktopTutorialCompleted(fetchedDesktopTutorial);
        }
        if (fetchedMobileTutorial !== undefined) {
          setMobileTutorialCompleted(fetchedMobileTutorial);
        }
        // Mark tutorial data as loaded
        setTutorialDataLoaded(true);
      }
      return response.data;
    },
    enabled: isClient && isAuthenticated, // Only run if on client and user is authenticated
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes
  });

  // Return the spaceCode, isAdmin, and onboardingStep from atoms, which are reactive
  return { spaceCode, onboardingStep };
}
