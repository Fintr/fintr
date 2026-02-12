"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { useTutorial } from '@/contexts/TutorialContext';
import { useSetAtom } from 'jotai';
import { isTutorialActiveAtom } from '@/atoms/tutorialAtoms';
import { usePathname } from 'next/navigation';

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
      {...tooltipProps}
      className="bg-white rounded-lg p-4 max-w-xs shadow-lg z-[10050]"
    >
      {step.content}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-black/10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSkipClick();
          }}
          className="text-primary bg-transparent border-none cursor-pointer text-sm py-2"
        >
          Skip
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
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
  
  // Don't run tutorial on onboarding pages
  const isOnOnboardingPage = pathname?.startsWith('/onboarding');

  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const isHandlingClickRef = React.useRef(false);
  const stepIndexRef = React.useRef(0);
  
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

  // Convert our tutorial steps to react-joyride format
  useEffect(() => {
    if (!isActive || !platform) {
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
              <h3 className="text-lg font-semibold text-primary mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-primary/70">
                {step.description}
              </p>
            </div>
          ),
          placement: finalPlacement,
          disableBeacon: true,
          disableOverlayClose: true,
          hideCloseButton: false,
          hideBackButton: true,
          disableActions: false,
          // Use waitForElement for steps that need to wait for elements to appear
          ...(step.waitForElement ? { 
            waitForElement: true 
          } : {}),
        };
      });

    setSteps(joyrideSteps);
    // Only reset stepIndex if tutorial is just starting (not if it's already running)
    setRun((prevRun) => {
      if (!prevRun) {
        setStepIndex(0); // Reset to first step only when starting
      }
      return true;
    });
    
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
  }, [isActive, platform, getConfig, setIsTutorialActive, isOnOnboardingPage]);


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
    // Update ref immediately to prevent race conditions
    stepIndexRef.current = currentStepIndex;
    setStepIndex(currentStepIndex);
    
    // Click the button to open the menu
    targetElement.click();
    
    // Wait for menu to open, then advance to next step
    setTimeout(() => {
      // Update ref immediately to prevent race conditions
      stepIndexRef.current = nextStepIndex;
      setStepIndex(nextStepIndex);
      isHandlingClickRef.current = false;
    }, 0);
    
    return true;
  }, []);

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
    
    // Click the "Add Transaction" button
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
        setTimeout(checkForElement, 100);
      }
    };
    
    // Start checking after initial delay
    setTimeout(checkForElement, 200);
    
    return true;
  }, []);

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
            
            // Wait for navigation to complete AND next element to be available
            const checkNavigationAndElement = (attempt = 0) => {
              const currentPath = window.location.pathname;
              const nextElement = document.querySelector(nextElementSelector) as HTMLElement | null;
              const isElementVisible = nextElement && nextElement.offsetParent !== null;
              
              const isNavigationComplete = currentPath === targetPath || currentPath.startsWith(targetPath);
              const maxAttempts = 30; // Allow up to 3 seconds (30 * 100ms)
              
              if ((isNavigationComplete && isElementVisible) || attempt >= maxAttempts) {
                // Navigation complete and element available, or timeout - advance to next step
                console.log('Navigation and element ready, advancing from step', currentStepIndex, 'to step', nextStepIndex, 
                  'navigation:', isNavigationComplete, 'element:', isElementVisible);
                stepIndexRef.current = nextStepIndex;
                setStepIndex(nextStepIndex);
                isHandlingClickRef.current = false;
              } else {
                // Still waiting, check again
                console.log(`Waiting for navigation/element (attempt ${attempt + 1}/${maxAttempts}):`, 
                  'path:', currentPath, 'target:', targetPath, 'element found:', !!nextElement, 'visible:', isElementVisible);
                setTimeout(() => checkNavigationAndElement(attempt + 1), 100);
              }
            };
            
            // Start checking after a short delay
            setTimeout(() => checkNavigationAndElement(), 100);
            return;
          }
          
          // Determine delay based on step ID and platform
          // Use 500ms for loan-menu-item on mobile (after navigation), otherwise 0ms
          const delay = currentStep?.id === 'loan-menu-item' && platform === 'mobile' ? 500 : 0;
          
          // Wait a bit, then advance to next step
          setTimeout(() => {
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
          }, delay);
          
          return;
        } else if (retryCount < 5) {
          // Retry finding the element (element might not be rendered yet)
          console.log(`Normal navigation: element not found, retrying (${retryCount + 1}/5) for step`, currentStepIndex, 'selector:', selector);
          setTimeout(() => findAndClickElement(retryCount + 1), 100);
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
  }, [getConfig, platform]);

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
        if (currentStep?.waitForElement) {
          // Clean the selector (remove pseudo-selectors)
          let selector = currentStep.targetSelector || '';
          if (selector.includes(':first-of-type')) {
            selector = selector.replace(':first-of-type', '').trim();
          }
          if (selector.includes(':first-child')) {
            selector = selector.replace(':first-child', '').trim();
          }
          
          // Retry finding the element with exponential backoff
          // For loan-menu-item, use more retries since it's after navigation (but navigation step should have waited)
          const isLoanMenuItem = currentStep?.id === 'loan-menu-item';
          let retryCount = 0;
          const maxRetries = isLoanMenuItem ? 30 : 10; // More retries for loan-menu-item
          const retryDelay = isLoanMenuItem ? 200 : 500; // Shorter delay but more retries for loan-menu-item
          
          const retryFindElement = () => {
            const targetElement = document.querySelector(selector) as HTMLElement | null;
            if (targetElement && targetElement.offsetParent !== null) {
              console.log('Element found after retry, continuing tutorial at step', index);
              // Element found and visible, continue with the same step
              // Update ref immediately to prevent race conditions
              stepIndexRef.current = index;
              setStepIndex(index);
            } else if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying to find element (attempt ${retryCount}/${maxRetries}):`, selector, 'visible:', targetElement?.offsetParent !== null);
              setTimeout(retryFindElement, retryDelay);
            } else {
              console.error('Element not found after max retries:', selector);
            }
          };
          
          // Start retrying after initial delay
          // For loan-menu-item, wait 500ms to allow page to fully load (navigation step should have already waited)
          const initialDelay = isLoanMenuItem ? 500 : retryDelay;
          setTimeout(retryFindElement, initialDelay);
        }
      }
    }
  }, [getConfig]);

  // Handle joyride callbacks
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    // Defer all callback logic to avoid flushSync errors during render cycle
    setTimeout(() => {
      const config = getConfig();
      if (!config) return;
      
      const currentStepIndex = stepIndexRef.current;
      const currentStep = currentStepIndex >= 0 && currentStepIndex < config.steps.length 
        ? config.steps[currentStepIndex] 
        : null;
      
      // Handle special action steps ONLY if we're currently handling a click
      if (action === 'next' && typeof index === 'number' && type === 'step:after' && !isHandlingClickRef.current) {
        
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
      }

      // Handle normal navigation for ALL other steps (highlight-only, click, or default)
      // IMPORTANT: Always handle navigation, even if isHandlingClickRef is true
      // This ensures "Next" button always works, especially for highlight-only steps
      if (action === 'next' && typeof index === 'number' && type === 'step:after') {
        // Skip if it's an 'open-menu' or 'click-menu-item' action (already handled above)
        if (currentStep?.action !== 'open-menu' && currentStep?.action !== 'click-menu-item') {
          handleNormalNavigation(index, action, type);
        }
      }

      // Handle tutorial completion, skip, or close (X button)
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        handleTutorialCompletion(status);
      } else if (action === 'skip') {
        handleTutorialCompletion(STATUS.SKIPPED);
      } else if (action === 'close' || type === 'tour:end') {
        handleTutorialCompletion(STATUS.SKIPPED);
      }

      // Handle errors
      if (status === STATUS.ERROR) {
        handleTutorialError(data);
      }
    }, 0);
  }, [
    getConfig,
    handleCreateTransactionButtonClick,
    handleTransactionMenuClick,
    handleNormalNavigation,
    handleTutorialCompletion,
    handleTutorialError,
  ]);

  // Don't render tutorial overlay on onboarding pages
  if (isOnOnboardingPage || !isActive || !platform || steps.length === 0) {
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
      disableOverlayClose={true}
      disableScrolling={true}
      scrollOffset={20}
      scrollToFirstStep={false}
      spotlightClicks={false}
      callback={handleJoyrideCallback}
      tooltipComponent={(props) => (
        <CustomTooltip {...props} onSkipClick={handleSkipClick} />
      )}
      styles={{
        options: {
          primaryColor: '#083d64',
          zIndex: 10050,
        },
        spotlight: {
          pointerEvents: 'none',
        },
      }}
    />
  );
};

export default TutorialOverlay;
