"use client";

import React,
       {
         createContext,
         useContext,
         useState,
         useEffect,
         useCallback,
         ReactNode,
       } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { completeTutorial } from '@/services/auth/user/tutorial';
import { performanceUtils } from '@/lib/utils';
import { getTutorialConfig as getTutorialConfigFromSteps } from '@/config/tutorialSteps';
import { useAtomValue } from 'jotai';
import { desktopTutorialCompletedAtom, mobileTutorialCompletedAtom, tutorialDataLoadedAtom } from '@/atoms/tutorialAtoms';
import { currentSpaceAtom } from '@/atoms/spaceAtoms';
import { dashboardShellReadyAtom } from '@/atoms/dashboardAtoms';
import { onboardingStepAtom } from '@/atoms/onboardingAtoms';
import { workspaceTransitionAtom } from '@/atoms/spaceAtoms';
import { useQueryClient } from '@tanstack/react-query';

export type TutorialPlatform = 'desktop' | 'mobile';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  waitForElement?: boolean;
  skipIfNotFound?: boolean;
  action?: 'click' | 'highlight-only' | 'open-menu' | 'click-menu-item';
  // 'click' - default, clicks the element and advances
  // 'highlight-only' - only highlights, no click, advances on Next
  // 'open-menu' - clicks to open a menu/popover, then advances
  // 'click-menu-item' - clicks an item in a menu and waits for next element
}

export interface TutorialConfig {
  steps: TutorialStep[];
}

interface TutorialContextType {
  isActive: boolean;
  platform: TutorialPlatform | null;
  startTutorial: (platform: TutorialPlatform) => void;
  skipTutorial: () => void;
  completeTutorial: () => Promise<void>;
  getConfig: () => TutorialConfig | null;
  isTutorialCompleted: (platform: TutorialPlatform) => boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const { spaceCode } = useGetSpaceCode(
    api,
    isAuthenticated && !isAuthLoading,
  );
  const queryClient = useQueryClient();
  const pathname = usePathname();
  
  const desktopTutorialCompleted = useAtomValue(desktopTutorialCompletedAtom);
  const mobileTutorialCompleted = useAtomValue(mobileTutorialCompletedAtom);
  const tutorialDataLoaded = useAtomValue(tutorialDataLoadedAtom);
  const currentSpace = useAtomValue(currentSpaceAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const transitionState = useAtomValue(workspaceTransitionAtom);
  const dashboardShellReady = useAtomValue(dashboardShellReadyAtom);
  
  const [isActive, setIsActive] = useState(false);
  const [platform, setPlatform] = useState<TutorialPlatform | null>(null);
  const [isCompletingTutorial, setIsCompletingTutorial] = useState(false);

  // Detect platform (with SSR guard)
  const detectPlatform = useCallback((): TutorialPlatform => {
    if (typeof window === 'undefined') return 'desktop';
    return performanceUtils.isMobileDevice() ? 'mobile' : 'desktop';
  }, []);

  // Check if tutorial is completed for a platform
  const isTutorialCompleted = useCallback((platform: TutorialPlatform): boolean => {
    if (platform === 'desktop') {
      return !!desktopTutorialCompleted;
    } else {
      return !!mobileTutorialCompleted;
    }
  }, [desktopTutorialCompleted, mobileTutorialCompleted]);

  // Complete tutorial handler - defined early to avoid initialization issues
  const completeTutorialHandlerRef = useCallback(async (currentPlatform: TutorialPlatform | null) => {
    if (!currentPlatform || !api) return;
    
    try {
      setIsCompletingTutorial(true);
      await completeTutorial({ api, platform: currentPlatform });
      setIsActive(false);
      setPlatform(null);
      // Refetch the currentUser query to get updated tutorial completion status
      // Wait for it to complete to prevent race condition where tutorial restarts
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
      // Small delay to ensure atoms are updated before allowing tutorial to start again
      setTimeout(() => {
        setIsCompletingTutorial(false);
      }, 100);
    } catch (error) {
      console.error('Error completing tutorial:', error);
      setIsCompletingTutorial(false);
    }
  }, [api, queryClient]);

  const completeTutorialHandler = useCallback(async () => {
    await completeTutorialHandlerRef(platform);
  }, [platform, completeTutorialHandlerRef]);

  // Check if tutorial should be shown on mount
  useEffect(() => {
    // Don't start tutorial until we've loaded tutorial completion data from the backend
    if (!user || typeof window === 'undefined' || !tutorialDataLoaded) {
      return;
    }
    
    // Don't start tutorial if we're currently completing it (prevents restart after completion)
    if (isCompletingTutorial) {
      return;
    }

    // Don't start tutorial on onboarding pages - check this first and stop if already active
    if (pathname?.startsWith('/onboarding')) {
      // If tutorial is already active, stop it immediately
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    // New users must finish workspace setup before the product tour
    if (onboardingStep !== 'completed') {
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    // Wait until workspace context exists (dashboard shell has left its loading state)
    if (!spaceCode) {
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    if (!dashboardShellReady) {
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    if (transitionState.isTransitioning) {
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    // Tour targets live on dashboard chrome (tabs, bottom nav, header actions)
    if (!pathname?.startsWith('/dashboard')) {
      if (isActive) {
        setIsActive(false);
        setPlatform(null);
      }
      return;
    }

    const detectedPlatform = detectPlatform();
    const completed = isTutorialCompleted(detectedPlatform);

    // If tutorial is completed but isActive is stuck, reset it
    if (completed && isActive) {
      setIsActive(false);
      setPlatform(null);
      return;
    }

    if (!completed && !isActive) {
      const startTimer = setTimeout(() => {
        setPlatform(detectedPlatform);
        setIsActive(true);
      }, 500);

      return () => clearTimeout(startTimer);
    }
  }, [
    user,
    detectPlatform,
    isTutorialCompleted,
    isActive,
    desktopTutorialCompleted,
    mobileTutorialCompleted,
    tutorialDataLoaded,
    isCompletingTutorial,
    pathname,
    onboardingStep,
    spaceCode,
    dashboardShellReady,
    transitionState.isTransitioning,
  ]);

  const startTutorial = useCallback((platform: TutorialPlatform) => {
    setPlatform(platform);
    setIsActive(true);
  }, []);

  const getTutorialConfig = useCallback((): TutorialConfig | null => {
    if (!platform) return null;
    return getTutorialConfigFromSteps(platform, currentSpace?.currency ?? undefined);
  }, [platform, currentSpace?.currency]);

  const skipTutorial = useCallback(async () => {
    await completeTutorialHandlerRef(platform);
  }, [platform, completeTutorialHandlerRef]);

  const getConfig = useCallback((): TutorialConfig | null => {
    return getTutorialConfig();
  }, [getTutorialConfig]);

  const value: TutorialContextType = {
    isActive,
    platform,
    startTutorial,
    skipTutorial,
    completeTutorial: completeTutorialHandler,
    getConfig,
    isTutorialCompleted,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

