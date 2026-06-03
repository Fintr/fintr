"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAtomValue, useSetAtom } from 'jotai';
import { isTutorialActiveAtom } from '@/atoms/tutorialAtoms';
import { onboardingStepAtom } from '@/atoms/onboardingAtoms';
import { dashboardShellReadyAtom } from '@/atoms/dashboardAtoms';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

const TUTORIAL_Z_INDEX = 10050;

/** Brand navy on white tooltip — bypasses `.dark .text-primary` (light blue on dark UI). */
const tooltipTextClass = "text-[color:var(--primary)]";
const tooltipTextMutedClass =
  "text-[color:color-mix(in_oklab,var(--primary)_70%,transparent)]";

const isTourTargetVisible = (selector: string): boolean => {
  const element = document.querySelector(selector) as HTMLElement | null;
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number.parseFloat(style.opacity) === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

// Custom tooltip component with working skip button
interface CustomTooltipProps extends TooltipRenderProps {
  onSkipClick: () => void;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  index,
  step,
  primaryProps,
  tooltipProps,
  size,
  isLastStep,
  onSkipClick,
}) => {
  return (
    <div
      ref={tooltipProps.ref}
      role={tooltipProps.role}
      aria-modal={tooltipProps['aria-modal']}
      className={`relative bg-white rounded-lg p-4 min-w-[260px] max-w-[min(100vw-2rem,20rem)] shadow-lg ${tooltipTextClass}`}
      style={{ zIndex: TUTORIAL_Z_INDEX + 2 }}
      data-testid="tutorial-tooltip"
    >
      <button
        type="button"
        aria-label="Close tour"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSkipClick();
        }}
        className={`absolute right-2 top-2 rounded-full p-2 ${tooltipTextMutedClass} hover:bg-primary/10 hover:text-[color:var(--primary)]`}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">{step.content}</div>
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-black/10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSkipClick();
          }}
          className={`${tooltipTextClass} bg-transparent border-none cursor-pointer text-sm py-2 min-h-[44px]`}
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${tooltipTextMutedClass}`}>
            {index + 1}/{size}
          </span>
          <button
            {...primaryProps}
            className="bg-primary text-white rounded-md px-4 py-2 border-none cursor-pointer text-sm font-medium min-w-[80px]"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const isHandlingClickRef = React.useRef(false);
  const stepIndexRef = React.useRef(0);
  
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
        // Convert position to react-joyride placement
        const placementMap: Record<string, 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto'> = {
          top: 'top',
          bottom: 'bottom',
          left: 'left',
          right: 'right',
          center: 'center',
        };

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
        const finalPlacement = placementMap[step.position || 'bottom'] || 'auto';

        return {
          target: finalTarget,
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
            styles: {
              floater: {
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

  // Ensure popover content and modal have appropriate z-index
  useEffect(() => {
    // Don't run tutorial on onboarding pages
    if (isOnOnboardingPage || !isActive) return;

    const ensureElementsAccessible = () => {
      // Ensure popover content has high z-index
      const popoverContent = document.querySelector('[data-radix-portal]');
      if (popoverContent) {
        (popoverContent as HTMLElement).style.zIndex = '10010';
      }
      
      // Ensure modal content is below tutorial but still accessible
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent) {
        (modalContent as HTMLElement).style.zIndex = '10040';
      }
      
      // Ensure modal overlay is below tutorial
      const modalOverlay = document.querySelector('[data-modal-content]')?.parentElement?.previousElementSibling as HTMLElement;
      if (modalOverlay) {
        modalOverlay.style.zIndex = '10039';
      }
    };

    const interval = setInterval(ensureElementsAccessible, 100);
    return () => clearInterval(interval);
  }, [isActive, isOnOnboardingPage]);

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
    
    // For 'highlight-only': just advance, no clicking
    if (currentStep?.action === 'highlight-only' && action === 'next' && type === 'step:after') {
      const nextStepIndex = index === currentStepIndex ? currentStepIndex + 1 : index;
      console.log(`Highlight-only step: advancing from ${currentStepIndex} to ${nextStepIndex} without clicking`);
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
          
          // For Radix UI tabs, we need to dispatch proper events
          // Try multiple approaches to ensure the click works
          const clickElement = () => {
            // Method 1: Standard click
            targetElement.click();
            
            // Method 2: Dispatch mouse events in sequence (for Radix UI compatibility)
            const mouseDownEvent = new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: 1,
              buttons: 1,
            });
            targetElement.dispatchEvent(mouseDownEvent);
            
            const mouseUpEvent = new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: 1,
              buttons: 0,
            });
            targetElement.dispatchEvent(mouseUpEvent);
            
            // Method 3: Dispatch click event with full options
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: 1,
              buttons: 0,
            });
            targetElement.dispatchEvent(clickEvent);
            
            // Method 4: Try pointer events (for touch devices)
            if (window.PointerEvent) {
              const pointerDownEvent = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                buttons: 1,
              });
              targetElement.dispatchEvent(pointerDownEvent);
              
              const pointerUpEvent = new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                buttons: 0,
              });
              targetElement.dispatchEvent(pointerUpEvent);
            }
          };
          
          clickElement();
          
          // Special handling for steps that trigger navigation
          // If this step navigates to a new page, wait for navigation to complete AND next element to be available
          const isNavigationStep = currentStep?.id === 'mobile-menu-button' || currentStep?.id === 'dashboard-tab';
          
          if (isNavigationStep) {
            // Get the next step to check if its element is available
            const nextStepIndex = currentStepIndex + 1;
            const nextStep = config.steps[nextStepIndex];
            
            // Determine target path and next element selector
            let targetPath = '';
            let nextElementSelector = '';
            
            if (currentStep?.id === 'mobile-menu-button') {
              targetPath = '/dashboard/app_settings';
              nextElementSelector = nextStep?.targetSelector || '[data-tutorial-target="loan-menu-item"]';
            } else if (currentStep?.id === 'dashboard-tab') {
              targetPath = '/dashboard/insights';
              nextElementSelector = nextStep?.targetSelector || '[data-tutorial-target="dashboard-summary"]';
            }
            
            // Poll until the next element is visible — no hard timeout so slow navigation always works.
            // We use an interval that checks every 200ms and gives up after 60 seconds.
            const maxAttempts = 300; // 300 × 200ms = 60 seconds
            let attempts = 0;
            const pollInterval = trackInterval(setInterval(() => {
              attempts++;
              const nextElement = document.querySelector(nextElementSelector) as HTMLElement | null;
              const isElementVisible = nextElement && nextElement.offsetParent !== null;

              if (isElementVisible || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                console.log(
                  'Navigation element ready, advancing from step', currentStepIndex, 'to step', nextStepIndex,
                  'element visible:', isElementVisible,
                );
                stepIndexRef.current = nextStepIndex;
                setStepIndex(nextStepIndex);
                isHandlingClickRef.current = false;
              }
            }, 200));
            
            return;
          }
          
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
  }, [getConfig, platform, trackTimeout, trackInterval]);

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
          if (targetElement && targetElement.offsetParent !== null) {
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

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous={true}
      showProgress={false}
      showSkipButton={false}
      disableOverlayClose={false}
      disableScrolling={true}
      scrollOffset={20}
      scrollToFirstStep={true}
      spotlightClicks={false}
      debug={process.env.NODE_ENV === 'development'}
      callback={handleJoyrideCallback}
      tooltipComponent={(props) => (
        <CustomTooltip {...props} onSkipClick={handleSkipClick} />
      )}
      styles={{
        options: {
          primaryColor: '#083d64',
          zIndex: TUTORIAL_Z_INDEX,
        },
        overlay: {
          cursor: 'pointer',
          zIndex: TUTORIAL_Z_INDEX,
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
  );
};

export default TutorialOverlay;
