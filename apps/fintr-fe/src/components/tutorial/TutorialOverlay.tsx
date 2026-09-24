"use client";

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAtomValue, useSetAtom } from 'jotai';
import { isTutorialActiveAtom } from '@/atoms/tutorialAtoms';
import { onboardingStepAtom } from '@/atoms/onboardingAtoms';
import { dashboardShellReadyAtom } from '@/atoms/dashboardAtoms';
import { pendingDashboardBottomTabAtom } from '@/atoms/dashboardBottomTabAtoms';
import { commitDashboardClientNavigation } from '@/lib/dashboard-nav-routes';
import {
  activateTourTargetOnce,
  isFixedMobileTourStep,
  isTourTabStep,
  isTourTargetReady,
  isTourTargetVisible,
  planAdvanceToTabStep,
  resolveTourStepNavigation,
  shouldCommitTourNavigationImmediately,
  shouldRunTourAction,
  shouldRunTourActionOnPointerDown,
  shouldHideTourOverlay,
  tourBlockingOverlayStyle,
  tourSpotlightPanels,
  tourTooltipCardStyle,
  tourTooltipPlacement,
  TUTORIAL_Z_INDEX,
} from '@/components/tutorial/tour-step-navigation';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  hasNestedOverlayContent,
  isVisibleModalContentOpen,
  NESTED_OVERLAY_LAYER_Z_INDEX,
} from '@/lib/nested-overlay-portal';

/** Brand navy on white tooltip — bypasses `.dark .text-primary` (light blue on dark UI). */
const tooltipTextClass = "text-[color:var(--primary)]";
const tooltipTextMutedClass =
  "text-[color:color-mix(in_oklab,var(--primary)_70%,transparent)]";

function readTourSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  probe.style.paddingRight = "env(safe-area-inset-right)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  probe.style.paddingLeft = "env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const style = window.getComputedStyle(probe);
  const parsed = {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();

  return {
    top: Math.max(16, parsed.top),
    right: Math.max(16, parsed.right),
    bottom: Math.max(16, parsed.bottom),
    left: Math.max(16, parsed.left),
  };
}

// Custom tooltip component with working skip button
interface CustomTooltipProps extends TooltipRenderProps {
  actionLockRef: { current: number };
  onSkipClick: () => void;
  onOpenNavigation: () => boolean;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  index,
  step,
  primaryProps,
  tooltipProps,
  size,
  isLastStep,
  actionLockRef,
  onSkipClick,
  onOpenNavigation,
}) => {
  const targetSelector = typeof step.target === "string" ? step.target : null;
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [cardStyle, setCardStyle] = useState<ReturnType<typeof tourTooltipCardStyle> | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const element = targetSelector
        ? document.querySelector(targetSelector)
        : null;
      const rect = element instanceof HTMLElement
        ? element.getBoundingClientRect()
        : null;
      const measuredHeight = cardRef.current?.getBoundingClientRect().height;

      setCardStyle(
        tourTooltipCardStyle({
          placement: step.placement,
          target: rect,
          cardHeight: measuredHeight && measuredHeight > 0 ? measuredHeight : undefined,
          insets: readTourSafeAreaInsets(),
          zIndex: isVisibleModalContentOpen() || hasNestedOverlayContent()
            ? NESTED_OVERLAY_LAYER_Z_INDEX - 20
            : undefined,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }),
      );
    };

    update();
    const intervalId = window.setInterval(update, 200);
    window.addEventListener("resize", update);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", update);
    };
  }, [step.placement, targetSelector]);

  const runTourAction = (action: string | null) => {
    if (action !== "skip" && action !== "next") {
      return;
    }

    const now = Date.now();
    if (!shouldRunTourAction(actionLockRef.current, now)) {
      return;
    }
    actionLockRef.current = now;

    if (action === "skip") {
      onSkipClick();
      return;
    }

    if (onOpenNavigation()) {
      return;
    }

    primaryProps.onClick?.({
      preventDefault() {},
      stopPropagation() {},
    } as React.MouseEvent<HTMLButtonElement>);
  };

  const press = (
    action: "skip" | "next",
  ) => (
    event: React.SyntheticEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    runTourAction(action);
  };

  const pressPointer = (
    action: "skip" | "next",
  ) => (
    event: React.PointerEvent,
  ) => {
    if (!shouldRunTourActionOnPointerDown(event.pointerType)) {
      return;
    }

    press(action)(event);
  };

  const card = (
    <div
      role="dialog"
      aria-modal="false"
      ref={cardRef}
      className={`bg-white rounded-lg p-4 shadow-lg ${tooltipTextClass}`}
      style={cardStyle ?? tourTooltipCardStyle({
        placement: step.placement,
        target: null,
        viewport: {
          width: typeof window === "undefined" ? 390 : window.innerWidth,
          height: typeof window === "undefined" ? 700 : window.innerHeight,
        },
      })}
      data-testid="tutorial-tooltip"
    >
      <button
        type="button"
        aria-label="Close tour"
        data-tour-action="skip"
        onPointerDown={pressPointer("skip")}
        onClick={press("skip")}
        className={`absolute right-2 top-2 rounded-full p-2 min-h-[44px] min-w-[44px] ${tooltipTextMutedClass}`}
        style={{ pointerEvents: "auto", touchAction: "manipulation" }}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">{step.content}</div>
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-black/10">
        <button
          type="button"
          data-tour-action="skip"
          onPointerDown={pressPointer("skip")}
          onClick={press("skip")}
          className={`${tooltipTextClass} bg-transparent border-none cursor-pointer text-sm py-2 min-h-[48px] px-2`}
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${tooltipTextMutedClass}`}>
            {index + 1}/{size}
          </span>
          <button
            type="button"
            data-tour-action="next"
            onPointerDown={pressPointer("next")}
            onClick={press("next")}
            className="bg-primary text-white rounded-md px-4 py-2 border-none cursor-pointer text-sm font-medium min-w-[88px] min-h-[48px]"
            style={{ pointerEvents: "auto", touchAction: "manipulation" }}
          >
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span ref={tooltipProps.ref} />
      {createPortal(card, document.body)}
    </>
  );
};

function TourSpotlight({ target }: { target: string }) {
  const [panels, setPanels] = useState<ReturnType<typeof tourSpotlightPanels>>([]);

  useLayoutEffect(() => {
    const update = () => {
      const element = document.querySelector(target);
      if (!(element instanceof HTMLElement)) {
        setPanels([]);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setPanels([]);
        return;
      }

      setPanels(
        tourSpotlightPanels({
          hole: rect,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }),
      );
    };

    update();
    const intervalId = window.setInterval(update, 200);
    window.addEventListener("resize", update);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", update);
    };
  }, [target]);

  if (panels.length === 0) {
    return null;
  }

  return createPortal(
    <>
      {panels.map((panel) => (
        <div
          key={`${panel.top}-${panel.left}-${panel.width}-${panel.height}`}
          aria-hidden
          data-testid="tour-spotlight"
          style={{ ...panel, zIndex: TUTORIAL_Z_INDEX }}
        />
      ))}
    </>,
    document.body,
  );
}

const TutorialOverlay: React.FC = () => {
  const {
    isActive,
    platform,
    getConfig,
    completeTutorial,
    skipTutorial,
  } = useTutorial();

  const pathname = usePathname();
  const setIsTutorialActive = useSetAtom(isTutorialActiveAtom);
  const setPendingTab = useSetAtom(pendingDashboardBottomTabAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const dashboardShellReady = useAtomValue(dashboardShellReadyAtom);

  // Don't run tutorial on onboarding pages
  const isOnOnboardingPage = pathname?.startsWith('/onboarding');
  const isOnboardingComplete = onboardingStep === 'completed';
  const canRunTour =
    isOnboardingComplete &&
    !isOnOnboardingPage &&
    dashboardShellReady &&
    pathname?.startsWith('/dashboard');

  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [allowModalInteraction, setAllowModalInteraction] = useState(false);
  const isHandlingClickRef = React.useRef(false);
  const stepIndexRef = React.useRef(0);
  const tourActionLockRef = React.useRef(0);
  
  // Refs for tracking timeouts and intervals for cleanup
  const timeoutsRef = React.useRef<NodeJS.Timeout[]>([]);
  const intervalsRef = React.useRef<NodeJS.Timeout[]>([]);
  
  // Helper to track timeouts
  const trackTimeout = React.useCallback((timeoutId: NodeJS.Timeout) => {
    timeoutsRef.current.push(timeoutId);
    return timeoutId;
  }, []);
  
  // Helper to track intervals
  const trackInterval = React.useCallback((intervalId: NodeJS.Timeout) => {
    intervalsRef.current.push(intervalId);
    return intervalId;
  }, []);
  
  // Cleanup all timeouts and intervals on unmount
  useEffect(() => {
    return () => {
      // Clear all tracked timeouts
      timeoutsRef.current.forEach(id => clearTimeout(id));
      timeoutsRef.current = [];
      
      // Clear all tracked intervals
      intervalsRef.current.forEach(id => clearInterval(id));
      intervalsRef.current = [];
    };
  }, []);
  
  // Keep ref in sync with state
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  // Radix tabs select on mousedown. If this step is a tab, select it so the
  // spotlight and the open form match the step instead of the previous tab.
  useEffect(() => {
    if (!isActive || !run) {
      return;
    }

    const config = getConfig();
    const step = config?.steps[stepIndex];
    if (!isTourTabStep(step?.id) || !step?.targetSelector) {
      return;
    }

    const selector = step.targetSelector;
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (isTourTargetReady(selector) || attempts > 20) {
        window.clearInterval(intervalId);
        return;
      }

      const tab = document.querySelector(selector);
      if (tab instanceof HTMLElement) {
        activateTourTargetOnce(tab);
      }
    }, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [getConfig, isActive, run, stepIndex]);

  // The menu screen is a separate chunk. Load it while this step is on screen
  // so Next can open it before the loans tile step.
  useEffect(() => {
    if (!isActive || !run) {
      return;
    }

    const config = getConfig();
    const stepId = config?.steps[stepIndex]?.id;
    if (stepId === "mobile-menu-button") {
      void import("@/app/(private)/dashboard/app_settings/page");
    }
  }, [getConfig, isActive, run, stepIndex]);

  // Tapping Menu itself opens the screen. Advance once the next tile is painted
  // so the tour does not stay stuck on the bottom tab.
  useEffect(() => {
    if (!run) {
      return;
    }

    const config = getConfig();
    const currentIndex = stepIndex;
    const step = config?.steps[currentIndex];
    const navigation = step
      ? resolveTourStepNavigation(
          step.id,
          config.steps[currentIndex + 1]?.targetSelector,
        )
      : null;

    if (!navigation) {
      return;
    }

    const intervalId = trackInterval(setInterval(() => {
      if (
        stepIndexRef.current !== currentIndex
        || isHandlingClickRef.current
      ) {
        return;
      }

      if (!isTourTargetVisible(navigation.nextTargetSelector)) {
        return;
      }

      const nextStepIndex = currentIndex + 1;
      commitDashboardClientNavigation(navigation.href);
      stepIndexRef.current = nextStepIndex;
      setStepIndex(nextStepIndex);
    }, 100));

    return () => {
      clearInterval(intervalId);
    };
  }, [getConfig, run, stepIndex, trackInterval]);

  const handleOpenNavigation = useCallback(() => {
    const config = getConfig();
    const index = stepIndexRef.current;
    const step = config?.steps[index];
    if (!step) {
      return false;
    }

    const navigation = resolveTourStepNavigation(
      step.id,
      config.steps[index + 1]?.targetSelector,
    );
    if (!navigation) {
      return false;
    }

    isHandlingClickRef.current = false;
    flushSync(() => {
      setPendingTab(navigation.tab);
    });

    if (shouldCommitTourNavigationImmediately(pathname)) {
      commitDashboardClientNavigation(navigation.href);
    }

    return true;
  }, [getConfig, pathname, setPendingTab]);

  // Handle skip button click - directly calls skipTutorial
  const handleSkipClick = useCallback(async () => {
    setRun(false);
    setIsTutorialActive(false);
    await skipTutorial();
  }, [skipTutorial, setIsTutorialActive]);

  // Escape key dismisses the tour (overlay may be blocking the UI)
  useEffect(() => {
    if (!run) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleSkipClick();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run, handleSkipClick]);

  // Convert our tutorial steps to react-joyride format
  useEffect(() => {
    if (!isActive || !platform || !canRunTour) {
      setRun(false);
      setSteps([]);
      return;
    }

    const config = getConfig();
    if (!config) {
      setRun(false);
      setSteps([]);
      return;
    }

    // Convert steps to react-joyride format
    const joyrideSteps: Step[] = config.steps
      .filter((step) => step.targetSelector) // Only include steps with valid selectors
      .map((step) => {
        // Handle pseudo-selectors that react-joyride doesn't support
        let target = step.targetSelector || '';
        if (target.includes(':contains(')) {
          // Remove the :contains() part - react-joyride will handle element finding
          target = target.split(':contains')[0].trim();
        }
        // Handle :first-of-type - react-joyride will naturally find the first matching element
        if (target.includes(':first-of-type')) {
          target = target.replace(':first-of-type', '').trim();
        }
        // Handle :first-child - react-joyride will naturally find the first matching element
        if (target.includes(':first-child')) {
          target = target.replace(':first-child', '').trim();
        }
        
        const finalTarget = target;
        const finalPlacement = tourTooltipPlacement(step.id, step.position);
        const fixedTarget = isFixedMobileTourStep(step.id, platform);

        return {
          target: finalTarget,
          isFixed: fixedTarget,
          content: (
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${tooltipTextClass}`}>
                {step.title}
              </h3>
              <p className={`text-sm ${tooltipTextMutedClass}`}>
                {step.description}
              </p>
            </div>
          ),
          placement: finalPlacement,
          disableBeacon: true,
          disableOverlayClose: false,
          hideCloseButton: false,
          hideBackButton: true,
          disableActions: false,
          floaterProps: {
            disableAnimation: fixedTarget,
            ...(fixedTarget
              ? { wrapperOptions: { position: false } }
              : {}),
            styles: {
              floater: {
                pointerEvents: "auto",
                zIndex: TUTORIAL_Z_INDEX + 2,
              },
            },
          },
          ...(step.waitForElement ? { waitForElement: true } : {}),
        };
      });

    setSteps(joyrideSteps);
    setRun(false);
    setStepIndex(0);

    // Add data attribute to body when tutorial is active (for backward compatibility)
    // Also set Jotai atom for React state management
    if (isActive) {
      document.body.setAttribute('data-tutorial-active', 'true');
      setIsTutorialActive(true);
    } else {
      document.body.removeAttribute('data-tutorial-active');
      setIsTutorialActive(false);
    }
    
    return () => {
      // Cleanup: Remove data attribute and reset atom when tutorial becomes inactive
      document.body.removeAttribute('data-tutorial-active');
      setIsTutorialActive(false);
    };
  }, [
    isActive,
    platform,
    getConfig,
    setIsTutorialActive,
    canRunTour,
  ]);

  // Only run Joyride once the first step target is in the DOM (dashboard finished loading)
  useEffect(() => {
    if (!isActive || !platform || !canRunTour || steps.length === 0) {
      setRun(false);
      return;
    }

    let cancelled = false;
    const firstTarget = steps[0]?.target;

    if (typeof firstTarget !== 'string') {
      setStepIndex(0);
      setRun(true);
      return;
    }

    const waitForFirstTarget = (attempt = 0) => {
      if (cancelled) {
        return;
      }

      if (isTourTargetVisible(firstTarget)) {
        setStepIndex(0);
        setRun(true);
        return;
      }

      if (attempt >= 60) {
        console.warn('Tutorial first target not found, skipping tour:', firstTarget);
        void handleSkipClick();
        return;
      }

      trackTimeout(setTimeout(() => waitForFirstTarget(attempt + 1), 100));
    };

    setRun(false);
    waitForFirstTarget();

    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    platform,
    steps,
    canRunTour,
    handleSkipClick,
    trackTimeout,
  ]);

  // Let users interact with modals and nested pickers (category, calculator, etc.)
  // while the tour tooltip remains visible.
  useLayoutEffect(() => {
    if (!isActive || !run) {
      setAllowModalInteraction(false);
      return;
    }

    const syncModalInteraction = () => {
      setAllowModalInteraction(
        isVisibleModalContentOpen() || hasNestedOverlayContent(),
      );
    };

    syncModalInteraction();
    const interval = setInterval(syncModalInteraction, 100);

    return () => {
      clearInterval(interval);
      setAllowModalInteraction(false);
    };
  }, [isActive, run]);

  // Watch for popover menu opening after clicking "+" button
  useEffect(() => {
    // Don't run tutorial on onboarding pages
    if (isOnOnboardingPage || !isActive || !run || steps.length === 0) return;

    // Check if we're on step 1 (waiting for the menu to appear)
    const config = getConfig();
    if (!config) return;

    const currentStep = config.steps[stepIndex];
    if (currentStep?.id === 'transaction-menu' && stepIndex === 1) {
      // Watch for popover menu to open
      const checkForPopover = () => {
        const popoverContent = document.querySelector('[data-radix-portal]');
        const addTransactionButton = document.querySelector('[data-tutorial-target="mobile-add-transaction"]') as HTMLElement;
        
        if (popoverContent && addTransactionButton && addTransactionButton.offsetParent !== null) {
          // Popover is open, the element should be found by react-joyride
          // No need to do anything, react-joyride will highlight it
        }
      };

      const interval = setInterval(checkForPopover, 200);
      return () => clearInterval(interval);
    }
  }, [isActive, run, stepIndex, steps.length, getConfig, isOnOnboardingPage]);

  // Handle clicking buttons that open menus (action: 'open-menu')
  const handleCreateTransactionButtonClick = useCallback((currentStep: any, config: any) => {
    const targetElement = document.querySelector(currentStep.targetSelector || '') as HTMLElement;
    if (!targetElement) return false;

    // Find the current step index
    const currentStepIndex = config.steps.findIndex((step: any) => step.id === currentStep.id);
    if (currentStepIndex === -1) {
      console.log('Open menu: current step not found in config!');
      return false;
    }

    const nextStepIndex = currentStepIndex + 1;
    console.log(`Open menu (${currentStep.id}): opening menu, will advance from step ${currentStepIndex} to ${nextStepIndex}`);

    isHandlingClickRef.current = true;
    stepIndexRef.current = currentStepIndex;
    setStepIndex(currentStepIndex);
    
    // Click the button to open the menu
    targetElement.click();
    
    // Get the next step's target selector to wait for it to appear
    const nextStep = config.steps[nextStepIndex];
    const nextSelector = nextStep?.targetSelector || '';

    const checkForNextElement = (attempt = 0) => {
      const maxAttempts = 20;
      const nextElement = nextSelector ? document.querySelector(nextSelector) as HTMLElement | null : null;
      const isVisible = nextElement && nextElement.offsetParent !== null;

      if (isVisible || attempt >= maxAttempts) {
        stepIndexRef.current = nextStepIndex;
        setStepIndex(nextStepIndex);
        isHandlingClickRef.current = false;
      } else {
        trackTimeout(setTimeout(() => checkForNextElement(attempt + 1), 100));
      }
    };

    // Start checking after a short delay to allow the menu to begin opening
    trackTimeout(setTimeout(() => checkForNextElement(), 150));
    
    return true;
  }, [trackTimeout]);

  // Handle clicking "Add Transaction" in the menu (for both transaction-menu and income-menu)
  const handleTransactionMenuClick = useCallback((currentStep: any, config: any) => {
    const targetElement = document.querySelector(currentStep.targetSelector || '') as HTMLElement;
    if (!targetElement) {
      console.log('Transaction menu: target element not found!');
      return false;
    }

    // Find the current step index
    const currentStepIndex = config.steps.findIndex((step: any) => step.id === currentStep.id);
    if (currentStepIndex === -1) {
      console.log('Transaction menu: current step not found in config!');
      return false;
    }

    // Get the next step (should be the tab step - either transaction-types or income-tab)
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex >= config.steps.length) {
      console.log('Transaction menu: no next step found!');
      return false;
    }

    const nextStep = config.steps[nextStepIndex];
    console.log(`Transaction menu (${currentStep.id}): clicking Add Transaction button, next step is ${nextStep.id} (index ${nextStepIndex})`);
    isHandlingClickRef.current = true;
    
    // Keep current step index while clicking
    setStepIndex(currentStepIndex);
    
    // Some buttons (e.g. "Add Transaction") use onPointerDown instead of onClick,
    // so we must dispatch pointerdown to trigger their handler.
    if (window.PointerEvent) {
      targetElement.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          view: window,
          pointerId: 1,
          pointerType: 'mouse',
          buttons: 1,
        })
      );
    }
    targetElement.click();
    
    // Wait for dialog to open and element to be available, then advance to next step
    const checkForElement = () => {
      console.log(`Transaction menu: checking for next step element (${nextStep.id}):`, nextStep?.targetSelector);
      const nextTargetElement = document.querySelector(nextStep?.targetSelector || '') as HTMLElement;
      console.log(`Transaction menu: next step element found:`, nextTargetElement, 'visible:', nextTargetElement?.offsetParent !== null);
      
      if (nextTargetElement && nextTargetElement.offsetParent !== null) {
        // Element is found and visible, advance to next step
        console.log(`Transaction menu: advancing to step ${nextStepIndex} (${nextStep.id})`);
        // Update ref immediately to prevent race conditions
        stepIndexRef.current = nextStepIndex;
        setStepIndex(nextStepIndex);
        isHandlingClickRef.current = false;
      } else {
        // Element not found yet, check again after a short delay
        trackTimeout(setTimeout(checkForElement, 100));
      }
    };
    
    // Start checking after initial delay
    trackTimeout(setTimeout(checkForElement, 200));
    
    return true;
  }, [trackTimeout]);

  // Handle normal step navigation
  const handleNormalNavigation = useCallback((
    index: number,
    action: string,
    type: string
  ) => {
    const config = getConfig();
    if (!config || typeof index !== 'number') return;

    const currentStepIndex = stepIndexRef.current;
    const currentStep = currentStepIndex >= 0 && currentStepIndex < config.steps.length 
      ? config.steps[currentStepIndex] 
      : null;
    
    // For 'open-menu' or 'click-menu-item', these are handled in handleJoyrideCallback
    if (currentStep?.action === 'open-menu' || currentStep?.action === 'click-menu-item') {
      console.log(`Action-based step (${currentStep.action}) - handled in callback:`, currentStep.id);
      return; // These are handled specially in the callback
    }
    
    const tourNavigation = currentStep
      ? resolveTourStepNavigation(
          currentStep.id,
          config.steps[currentStepIndex + 1]?.targetSelector,
        )
      : null;

    if (tourNavigation && action === 'next' && type === 'step:after') {
      isHandlingClickRef.current = true;
      setPendingTab(tourNavigation.tab);
      commitDashboardClientNavigation(tourNavigation.href);

      const nextStepIndex = currentStepIndex + 1;
      const maxAttempts = 60;
      let attempts = 0;

      const pollInterval = trackInterval(setInterval(() => {
        attempts += 1;
        const visible = isTourTargetVisible(tourNavigation.nextTargetSelector);

        if (!visible && attempts < maxAttempts) {
          return;
        }

        clearInterval(pollInterval);

        if (visible) {
          stepIndexRef.current = nextStepIndex;
          setStepIndex(nextStepIndex);
          isHandlingClickRef.current = false;
          return;
        }

        isHandlingClickRef.current = false;
        setRun(false);
        trackTimeout(setTimeout(() => {
          setRun(true);
        }, 0));
      }, 50));

      return;
    }

    const nextStep = config.steps[currentStepIndex + 1];
    const tabAdvance = nextStep?.targetSelector
      ? planAdvanceToTabStep({
          currentAction: currentStep?.action,
          nextStepId: nextStep.id,
          nextTargetVisible: isTourTargetVisible(nextStep.targetSelector),
        })
      : null;
    if (
      tabAdvance &&
      action === 'next' &&
      type === 'step:after' &&
      nextStep?.targetSelector
    ) {
      const nextSelector = nextStep.targetSelector;
      if (
        tabAdvance === "activate-current-target" &&
        currentStep?.targetSelector
      ) {
        const opener = document.querySelector(currentStep.targetSelector);
        if (opener instanceof HTMLElement) {
          activateTourTargetOnce(opener);
        }
      } else {
        const tab = document.querySelector(nextSelector);
        if (tab instanceof HTMLElement) {
          activateTourTargetOnce(tab);
        }
      }

      const nextStepIndex = currentStepIndex + 1;
      isHandlingClickRef.current = true;
      let attempts = 0;
      const pollInterval = trackInterval(setInterval(() => {
        attempts += 1;
        const ready = isTourTargetReady(nextSelector);
        if (!ready && attempts < 40) {
          const tab = document.querySelector(nextSelector);
          if (tab instanceof HTMLElement && isTourTargetVisible(nextSelector)) {
            activateTourTargetOnce(tab);
          }
          return;
        }

        clearInterval(pollInterval);
        isHandlingClickRef.current = false;
        if (!ready) {
          return;
        }

        stepIndexRef.current = nextStepIndex;
        setStepIndex(nextStepIndex);
      }, 50));
      return;
    }

    // For 'highlight-only': just advance, no clicking
    if (currentStep?.action === 'highlight-only' && action === 'next' && type === 'step:after') {
      const nextStepIndex = index === currentStepIndex ? currentStepIndex + 1 : index;
      const nextSelector = config.steps[nextStepIndex]?.targetSelector;
      console.log(`Highlight-only step: advancing from ${currentStepIndex} to ${nextStepIndex} without clicking`);

      if (
        nextSelector &&
        config.steps[nextStepIndex]?.waitForElement
      ) {
        isHandlingClickRef.current = true;
        let attempts = 0;
        const pollInterval = trackInterval(setInterval(() => {
          attempts += 1;
          const ready = isTourTargetReady(nextSelector);
          if (!ready && attempts < 40) {
            return;
          }

          clearInterval(pollInterval);
          isHandlingClickRef.current = false;
          if (!ready) {
            return;
          }

          stepIndexRef.current = nextStepIndex;
          setStepIndex(nextStepIndex);
        }, 50));
        return;
      }

      // Update ref immediately to prevent race conditions
      stepIndexRef.current = nextStepIndex;
      setStepIndex(nextStepIndex);
      return;
    }
    
    // For default or 'click' action: click the element, then advance
    if ((currentStep?.action === 'click' || !currentStep?.action) && action === 'next' && type === 'step:after' && currentStep?.targetSelector) {
      console.log(`Click step: will click element for step ${currentStepIndex} (${currentStep.id})`);
      // The click logic continues below...
    } else if (action === 'next' && type === 'step:after') {
      // No target selector, just advance
      const nextStepIndex = index === currentStepIndex ? currentStepIndex + 1 : index;
      console.log(`No target selector: advancing from ${currentStepIndex} to ${nextStepIndex}`);
      stepIndexRef.current = nextStepIndex;
      setStepIndex(nextStepIndex);
      return;
    } else {
      // Not a 'next' action or not 'step:after', don't do anything
      return;
    }

    // Click logic for 'click' action steps
    if (currentStep?.targetSelector) {
      // Clean the selector (remove pseudo-selectors that might cause issues)
      let selector = currentStep.targetSelector;
      if (selector.includes(':first-of-type')) {
        selector = selector.replace(':first-of-type', '').trim();
      }
      if (selector.includes(':first-child')) {
        selector = selector.replace(':first-child', '').trim();
      }
      
      // Try to find the element with retry logic
      const findAndClickElement = (retryCount = 0) => {
        const targetElement = document.querySelector(selector) as HTMLElement;
        if (targetElement) {
          console.log('Normal navigation: clicking element for step', currentStepIndex, 'selector:', selector, 'step id:', currentStep.id);
          console.log("TARGET ELEMENT FOUND:", targetElement);
          isHandlingClickRef.current = true;
          
          activateTourTargetOnce(targetElement);

          // Determine delay based on step ID and platform
          // Use 500ms for loan-menu-item on mobile (after navigation), otherwise 0ms
          const delay = currentStep?.id === 'loan-menu-item' && platform === 'mobile' ? 500 : 0;
          
          // Wait a bit, then advance to next step
          trackTimeout(setTimeout(() => {
            // Calculate next step index
            let nextStepIndex = index;
            if (index === currentStepIndex) {
              // If index hasn't changed, we need to advance manually
              nextStepIndex = currentStepIndex + 1;
              console.log('Normal navigation: index unchanged, manually advancing from step', currentStepIndex, 'to step', nextStepIndex);
            } else {
              console.log('Normal navigation: advancing from step', currentStepIndex, 'to step', nextStepIndex);
            }
            
            // Update ref immediately to prevent race conditions
            stepIndexRef.current = nextStepIndex;
            setStepIndex(nextStepIndex);
            isHandlingClickRef.current = false;
          }, delay));
          
          return;
        } else if (retryCount < 5) {
          // Retry finding the element (element might not be rendered yet)
          console.log(`Normal navigation: element not found, retrying (${retryCount + 1}/5) for step`, currentStepIndex, 'selector:', selector);
          trackTimeout(setTimeout(() => findAndClickElement(retryCount + 1), 100));
          return;
        } else {
          console.warn('Normal navigation: element not found after retries for step', currentStepIndex, 'selector:', selector);
        }
      };
      
      findAndClickElement();
      return;
    }

    // Fallback: For normal navigation without clicking, react-joyride manages the step index internally
    // We just need to sync our state with react-joyride's state
    // When action is 'next' and type is 'step:after', index should be the step we're moving TO
    // But if index is the same as currentStepIndex, we need to advance manually
    let nextStepIndex = index;
    if (action === 'next' && type === 'step:after' && index === currentStepIndex) {
      // If index hasn't changed, we need to advance manually
      nextStepIndex = currentStepIndex + 1;
      console.log('Normal navigation: index unchanged, manually advancing from step', currentStepIndex, 'to step', nextStepIndex);
    } else {
      console.log('Normal navigation: advancing from step', currentStepIndex, 'to step', nextStepIndex);
    }
    // Update ref immediately to prevent race conditions
    stepIndexRef.current = nextStepIndex;
    setStepIndex(nextStepIndex);
  }, [getConfig, platform, setPendingTab, trackTimeout, trackInterval]);

  // Handle tutorial completion or skip
  const handleTutorialCompletion = useCallback(async (status: string) => {
    setRun(false);
    setIsTutorialActive(false);
    if (status === STATUS.FINISHED) {
      await completeTutorial();
    } else if (status === STATUS.SKIPPED) {
      await skipTutorial();
    }
  }, [completeTutorial, skipTutorial, setIsTutorialActive]);

  // Handle tutorial errors
  const handleTutorialError = useCallback((data: CallBackProps) => {
    console.error('Tutorial error:', data);
    
    const { index, type } = data;
    // If error is due to target not found, wait a bit and retry the same step
    if (typeof index === 'number' && type === 'error:target_not_found') {
      const config = getConfig();
      if (config) {
        const currentStep = config.steps[index];
        if (!currentStep?.waitForElement) {
          console.warn('Tutorial target missing on step without wait — dismissing tour');
          void handleTutorialCompletion(STATUS.SKIPPED);
          return;
        }

        // Clean the selector (remove pseudo-selectors)
        let selector = currentStep.targetSelector || '';
        if (selector.includes(':first-of-type')) {
          selector = selector.replace(':first-of-type', '').trim();
        }
        if (selector.includes(':first-child')) {
          selector = selector.replace(':first-child', '').trim();
        }

        // Retry finding the element with exponential backoff
        const isLoanMenuItem = currentStep?.id === 'loan-menu-item';
        let retryCount = 0;
        const maxRetries = isLoanMenuItem ? 30 : 10;
        const retryDelay = isLoanMenuItem ? 200 : 500;

        const retryFindElement = () => {
          const targetElement = document.querySelector(selector) as HTMLElement | null;
          if (isTourTargetVisible(selector)) {
            console.log('Element found after retry, continuing tutorial at step', index);
            stepIndexRef.current = index;
            setRun(false);
            trackTimeout(setTimeout(() => {
              setStepIndex(index);
              setRun(true);
            }, 50));
          } else if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying to find element (attempt ${retryCount}/${maxRetries}):`, selector, 'visible:', targetElement?.offsetParent !== null);
            trackTimeout(setTimeout(retryFindElement, retryDelay));
          } else {
            console.error('Element not found after max retries:', selector);
            void handleTutorialCompletion(STATUS.SKIPPED);
          }
        };

        const initialDelay = isLoanMenuItem ? 500 : retryDelay;
        trackTimeout(setTimeout(retryFindElement, initialDelay));
      } else {
        void handleTutorialCompletion(STATUS.SKIPPED);
      }
      return;
    }

    void handleTutorialCompletion(STATUS.SKIPPED);
  }, [getConfig, trackTimeout, handleTutorialCompletion]);

  // Handle joyride callbacks
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    const config = getConfig();
    if (!config) return;
    
    const currentStepIndex = stepIndexRef.current;
    const currentStep = currentStepIndex >= 0 && currentStepIndex < config.steps.length 
      ? config.steps[currentStepIndex] 
      : null;

    // Handle tutorial completion, skip, or close (X button) — always handle these immediately
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      handleTutorialCompletion(status);
      return;
    } else if (action === 'skip') {
      handleTutorialCompletion(STATUS.SKIPPED);
      return;
    } else if (action === 'close' || type === 'tour:end') {
      handleTutorialCompletion(STATUS.SKIPPED);
      return;
    }

    // Handle errors
    if (status === STATUS.ERROR) {
      handleTutorialError(data);
      return;
    }

    // Handle "Next" button presses
    if (action === 'next' && typeof index === 'number' && type === 'step:after') {
      // Skip if we're already handling a click (prevents double-firing)
      if (isHandlingClickRef.current) return;

      // Handle 'open-menu' action (e.g., mobile-add-button)
      if (currentStep?.action === 'open-menu') {
        if (handleCreateTransactionButtonClick(currentStep, config)) {
          return;
        }
      }
      
      // Handle 'click-menu-item' action (e.g., mobile-add-transaction, mobile-add-receipt)
      if (currentStep?.action === 'click-menu-item') {
        if (handleTransactionMenuClick(currentStep, config)) {
          return;
        }
      }

      // Handle all other step types (highlight-only, click, or default)
      if (currentStep?.action !== 'open-menu' && currentStep?.action !== 'click-menu-item') {
        handleNormalNavigation(index, action, type);
      }
    }
  }, [
    getConfig,
    handleCreateTransactionButtonClick,
    handleTransactionMenuClick,
    handleNormalNavigation,
    handleTutorialCompletion,
    handleTutorialError,
  ]);

  // Don't render tutorial overlay during setup or on onboarding pages
  if (
    isOnOnboardingPage ||
    !isOnboardingComplete ||
    !isActive ||
    !platform ||
    steps.length === 0
  ) {
    return null;
  }

  const activeStepId = getConfig()?.steps[stepIndex]?.id;
  const activeTarget = steps[stepIndex]?.target;
  const showSpotlight =
    run &&
    !allowModalInteraction &&
    !shouldHideTourOverlay(activeStepId) &&
    typeof activeTarget === "string";

  return (
    <>
    {showSpotlight && typeof activeTarget === "string" && (
      <TourSpotlight target={activeTarget} />
    )}
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous={true}
      showProgress={false}
      showSkipButton={false}
      disableOverlay={true}
      disableOverlayClose={true}
      disableScrolling={true}
      disableScrollParentFix={true}
      scrollOffset={20}
      scrollToFirstStep={true}
      spotlightClicks={true}
      debug={process.env.NODE_ENV === 'development'}
      callback={handleJoyrideCallback}
      tooltipComponent={(props) => (
        <CustomTooltip
          {...props}
          actionLockRef={tourActionLockRef}
          onSkipClick={handleSkipClick}
          onOpenNavigation={handleOpenNavigation}
        />
      )}
      styles={{
        options: {
          primaryColor: '#083d64',
          zIndex: TUTORIAL_Z_INDEX,
        },
        overlay: {
          ...tourBlockingOverlayStyle(),
          cursor: 'default',
        },
        spotlight: {
          pointerEvents: 'none',
          zIndex: TUTORIAL_Z_INDEX + 1,
        },
        tooltip: {
          zIndex: TUTORIAL_Z_INDEX + 2,
        },
        tooltipContainer: {
          zIndex: TUTORIAL_Z_INDEX + 2,
        },
      }}
    />
    </>
  );
};

export default TutorialOverlay;
