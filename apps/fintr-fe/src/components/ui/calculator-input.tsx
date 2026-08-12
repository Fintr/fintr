"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import {
  calculateAndroidBottomInsetPx,
  getSafeAreaInsets,
} from "@/lib/platform-detection";
import { numberFormatting } from "@/lib/utils";
import { getNestedOverlayPortalRoot } from "@/lib/nested-overlay-portal";
import {
  acquireCalculatorScrollPadding,
  computeKeyboardPlacement,
  findScrollableAncestor,
  keyboardLayoutReservesScrollSpace,
  measureKeyboardOcclusionHeight,
  releaseCalculatorScrollPadding,
  scrollInputClearOfKeyboard,
  type CalculatorKeyboardLayout,
  type CalculatorKeyboardPosition,
} from "./calculator-keyboard-scroll";

interface CalculatorInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// iOS-style calculator layout
// Row 1: backspace, C, %, ÷
// Row 2: 7, 8, 9, ×
// Row 3: 4, 5, 6, −
// Row 4: 1, 2, 3, +
// Row 5: ±, 0, ., =
const CALCULATOR_BUTTONS = [
  ["⌫", "C", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["±", "0", ".", "="],
];

// Map display symbols to actual operators for evaluation
const OPERATOR_MAP: Record<string, string> = {
  "÷": "/",
  "×": "*",
  "−": "-",
};

// Breakpoints for responsive behavior
const MOBILE_BREAKPOINT = 768; // md breakpoint
const MOBILE_KEYBOARD_VH = 0.4;
const KEYBOARD_GAP = 8;
const DESKTOP_KEYBOARD_WIDTH = 288;
const DESKTOP_FLOATING_BOTTOM_OFFSET_PX = 16;
/** Fits display + 5 rows of h-11 keys, gaps, and outer padding (do not set height below this). */
const DESKTOP_CALC_BUTTON_HEIGHT_PX = 44;
const DESKTOP_CALC_GRID_GAP_PX = 6;
const DESKTOP_CALC_OUTER_PADDING_PX = 24;
const DESKTOP_CALC_INNER_GAP_PX = 8;
const DESKTOP_CALC_DISPLAY_BLOCK_PX = 74;
const DESKTOP_KEYBOARD_MIN_HEIGHT =
  DESKTOP_CALC_OUTER_PADDING_PX
  + DESKTOP_CALC_INNER_GAP_PX
  + DESKTOP_CALC_DISPLAY_BLOCK_PX
  + 5 * DESKTOP_CALC_BUTTON_HEIGHT_PX
  + 4 * DESKTOP_CALC_GRID_GAP_PX;
/** Minimum touch target for bottom-sheet calculator keys (WCAG / Material). */
export const MOBILE_CALC_BUTTON_MIN_HEIGHT_PX = 48;
const MOBILE_CALC_GRID_GAP_CLASS = "gap-2.5";
const MOBILE_CALC_BUTTON_ROW_CLASS = "h-12 min-h-12 w-full";

const CALCULATOR_KEYBOARD_HISTORY_KEY = "__fintrCalculatorKeyboard";

const calculatorHistoryRegistry = {
  openCount: 0,
  historyActive: false,
};

let pendingCalculatorHistoryBackTimer: ReturnType<typeof setTimeout> | null = null;
const calculatorPopStateSubscribers = new Set<() => void>();
let calculatorPopStateListenerAttached = false;

function cancelPendingCalculatorHistoryBack() {
  if (pendingCalculatorHistoryBackTimer !== null) {
    clearTimeout(pendingCalculatorHistoryBackTimer);
    pendingCalculatorHistoryBackTimer = null;
  }
}

function handleCalculatorPopState(event: PopStateEvent) {
  if (event.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]) {
    return;
  }

  calculatorHistoryRegistry.historyActive = false;
  calculatorHistoryRegistry.openCount = 0;
  cancelPendingCalculatorHistoryBack();
  calculatorPopStateSubscribers.forEach((subscriber) => subscriber());
}

function ensureCalculatorPopStateListener() {
  if (calculatorPopStateListenerAttached) {
    return;
  }

  window.addEventListener("popstate", handleCalculatorPopState);
  calculatorPopStateListenerAttached = true;
}

function acquireCalculatorHistoryEntry() {
  cancelPendingCalculatorHistoryBack();

  if (!calculatorHistoryRegistry.historyActive) {
    window.history.pushState({ [CALCULATOR_KEYBOARD_HISTORY_KEY]: true }, "");
    calculatorHistoryRegistry.historyActive = true;
  }

  calculatorHistoryRegistry.openCount += 1;
}

function releaseCalculatorHistoryEntry() {
  calculatorHistoryRegistry.openCount = Math.max(
    0,
    calculatorHistoryRegistry.openCount - 1,
  );

  if (calculatorHistoryRegistry.openCount > 0) {
    cancelPendingCalculatorHistoryBack();
    return;
  }

  cancelPendingCalculatorHistoryBack();
  pendingCalculatorHistoryBackTimer = setTimeout(() => {
    pendingCalculatorHistoryBackTimer = null;

    if (calculatorHistoryRegistry.openCount > 0) {
      return;
    }

    if (!calculatorHistoryRegistry.historyActive) {
      return;
    }

    calculatorHistoryRegistry.historyActive = false;
    window.history.back();
  }, 0);
}

function subscribeCalculatorPopState(onClose: () => void) {
  ensureCalculatorPopStateListener();
  calculatorPopStateSubscribers.add(onClose);

  return () => {
    calculatorPopStateSubscribers.delete(onClose);

    if (calculatorPopStateSubscribers.size === 0 && calculatorPopStateListenerAttached) {
      window.removeEventListener("popstate", handleCalculatorPopState);
      calculatorPopStateListenerAttached = false;
    }
  };
}

function useCalculatorKeyboardHistory(
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    acquireCalculatorHistoryEntry();

    const unsubscribePopState = subscribeCalculatorPopState(() => {
      onCloseRef.current();
    });

    return () => {
      unsubscribePopState();
      releaseCalculatorHistoryEntry();
    };
  }, [open]);
}

type KeyboardLayout = CalculatorKeyboardLayout;

type KeyboardPosition = CalculatorKeyboardPosition;

function safeEvaluate(expression: string): number | null {
  try {
    // Remove commas for evaluation
    const sanitized = expression.replace(/,/g, "").replace(/[^0-9+\-*/.() ]/g, "");
    if (!sanitized || sanitized.trim() === "") return null;
    
    // Check for valid expression structure
    if (/[+\-*/]{2,}/.test(sanitized)) return null;
    if (/^[*/]/.test(sanitized.trim())) return null;
    if (/[+\-*/]$/.test(sanitized.trim())) return null;
    
    // Use Function constructor for safe evaluation (no eval)
    const result = new Function(`return (${sanitized})`)();
    
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function hasOperator(value: string): boolean {
  const raw = numberFormatting.stripDelimiters(value);

  if (/[+*/]/.test(raw)) {
    return true;
  }

  return raw.indexOf("-", 1) > 0;
}

function isCalculatorEnterKey(
  event: KeyboardEvent | React.KeyboardEvent,
): boolean {
  return event.key === "Enter" || event.code === "NumpadEnter";
}

function toRawExpression(value: string): string {
  return numberFormatting.stripDelimiters(value).replace(/[^0-9+\-*/.]/g, "");
}

function resolveMobileNavInsetMinHeightPx(
  isMobile: boolean,
  hasThreeButtonNav: boolean,
): number {
  if (!isMobile || typeof document === "undefined") {
    return 0;
  }

  const insets = getSafeAreaInsets();
  const usesThreeButtonNav =
    hasThreeButtonNav
    || document.documentElement.classList.contains("fintr-has-3btn-nav")
    || insets.bottom >= 40;

  return calculateAndroidBottomInsetPx(
    insets.bottom,
    usesThreeButtonNav,
  );
}

export function CalculatorInput({
  id,
  name,
  value,
  onChange,
  placeholder = "0.00",
  className = "",
  disabled = false,
}: CalculatorInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  // Internal expression state - may contain operators
  const [expression, setExpression] = useState("");
  // Track if we're in "expression mode" (user is typing a calculation)
  const [isExpressionMode, setIsExpressionMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const {
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();
  const [keyboardPosition, setKeyboardPosition] = useState<KeyboardPosition>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>("below");
  const [mounted, setMounted] = useState(false);

  const androidBottomInsetPx = useMemo(() => {
    if (!isAndroidNative) {
      return 0;
    }

    const insets = getSafeAreaInsets();

    return calculateAndroidBottomInsetPx(
      insets.bottom,
      hasAndroid3ButtonNav,
    );
  }, [
    isAndroidNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const collapseSelectionToEnd = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const length = input.value.length;

    try {
      input.setSelectionRange(length, length);
    } catch {
      // Input may not be focusable in some environments.
    }
  }, []);

  // Handle SSR - only render portal after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile/desktop and update on resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const applyKeyboardPlacement = useCallback(
    (input: HTMLElement) => {
      const placement = computeKeyboardPlacement(input, {
        isMobile,
        androidBottomInsetPx,
        mobileKeyboardViewportRatio: MOBILE_KEYBOARD_VH,
        desktopKeyboardMinHeight: DESKTOP_KEYBOARD_MIN_HEIGHT,
        desktopKeyboardWidth: DESKTOP_KEYBOARD_WIDTH,
        desktopFloatingBottomOffsetPx: DESKTOP_FLOATING_BOTTOM_OFFSET_PX,
        keyboardGap: KEYBOARD_GAP,
      });

      setKeyboardLayout(placement.layout);
      setKeyboardPosition(placement.position);
    },
    [androidBottomInsetPx, isMobile],
  );

  const updateKeyboardPosition = useCallback(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    applyKeyboardPlacement(input);
  }, [applyKeyboardPlacement]);

  useEffect(() => {
    if (!showKeyboard || !inputRef.current) {
      return;
    }

    updateKeyboardPosition();
    window.addEventListener("scroll", updateKeyboardPosition, true);
    window.addEventListener("resize", updateKeyboardPosition);

    return () => {
      window.removeEventListener("scroll", updateKeyboardPosition, true);
      window.removeEventListener("resize", updateKeyboardPosition);
    };
  }, [showKeyboard, updateKeyboardPosition]);

  useLayoutEffect(() => {
    if (!showKeyboard || disabled) {
      return;
    }

    const input = inputRef.current;

    if (!input || !keyboardLayoutReservesScrollSpace(keyboardLayout)) {
      return;
    }

    const scrollParent = findScrollableAncestor(input);
    const fallbackKeyboardHeightPx = isMobile
      ? window.innerHeight * MOBILE_KEYBOARD_VH
      : DESKTOP_KEYBOARD_MIN_HEIGHT;
    let scrollPaddingAcquired = false;

    const syncScrollPaddingAndPosition = (
      scrollBehavior: ScrollBehavior = "instant",
    ) => {
      const keyboardHeightPx = measureKeyboardOcclusionHeight(
        keyboardRef.current,
        fallbackKeyboardHeightPx,
      );

      if (scrollParent) {
        if (!scrollPaddingAcquired) {
          acquireCalculatorScrollPadding(scrollParent, keyboardHeightPx);
          scrollPaddingAcquired = true;
        } else {
          scrollParent.style.paddingBottom = `${keyboardHeightPx}px`;
        }
      }

      scrollInputClearOfKeyboard(
        input,
        keyboardHeightPx,
        12,
        scrollBehavior,
      );
    };

    syncScrollPaddingAndPosition("instant");

    const visualViewport = window.visualViewport;
    const handleViewportChange = () => {
      syncScrollPaddingAndPosition("smooth");
    };

    window.addEventListener("resize", handleViewportChange);
    visualViewport?.addEventListener("resize", handleViewportChange);
    visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      visualViewport?.removeEventListener("resize", handleViewportChange);
      visualViewport?.removeEventListener("scroll", handleViewportChange);

      if (scrollParent && scrollPaddingAcquired) {
        releaseCalculatorScrollPadding(scrollParent);
      }
    };
  }, [
    disabled,
    isMobile,
    keyboardLayout,
    showKeyboard,
  ]);

  // Sync with external value when not in expression mode
  useEffect(() => {
    if (!isExpressionMode) {
      setExpression(numberFormatting.stripDelimiters(value));
    }
  }, [value, isExpressionMode]);

  // Avoid select-all flash when the value updates from calculator keys
  useEffect(() => {
    if (!showKeyboard) {
      return;
    }

    requestAnimationFrame(collapseSelectionToEnd);
  }, [expression, showKeyboard, collapseSelectionToEnd]);

  const dismissKeyboard = useCallback(() => {
    setShowKeyboard(false);
    if (isExpressionMode && hasOperator(expression)) {
      const result = safeEvaluate(expression);
      if (result !== null) {
        const rounded = Math.round(result * 100) / 100;
        const resultStr = rounded.toString();
        setExpression(resultStr);
        setIsExpressionMode(false);
        onChange(resultStr);
      } else {
        setIsExpressionMode(false);
        setExpression(value);
      }
    }
  }, [expression, isExpressionMode, onChange, value]);

  const dismissKeyboardRef = useRef(dismissKeyboard);
  dismissKeyboardRef.current = dismissKeyboard;

  const handleKeyboardOverlayOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      dismissKeyboardRef.current();
    }
  }, []);

  useCalculatorKeyboardHistory(
    showKeyboard && !disabled,
    () => {
      handleKeyboardOverlayOpenChange(false);
    },
  );

  // Handle clicks outside to close keyboard
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideKeyboard = target.closest("[data-calculator-keyboard]") != null;
      const clickedAnotherCalculatorInput =
        !clickedInsideContainer
        && target.closest("[data-calculator-input]") != null;

      if (clickedAnotherCalculatorInput) {
        if (showKeyboardRef.current) {
          dismissKeyboardRef.current();
        }

        return;
      }

      if (!clickedInsideContainer && !clickedInsideKeyboard) {
        dismissKeyboardRef.current();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatPreviewAmount = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;

    return numberFormatting.formatForInput(rounded.toString());
  };

  const displayExpression = numberFormatting.formatExpressionForDisplay(expression);
  const keyboardDisplayValue = displayExpression.trim() === "" ? placeholder : displayExpression;

  const keyboardPreviewLine = useMemo(() => {
    const raw = numberFormatting.stripDelimiters(expression).trim();

    if (raw === "") {
      return `= ${placeholder}`;
    }

    const evaluated = safeEvaluate(raw);

    if (evaluated !== null) {
      return `= ${formatPreviewAmount(evaluated)}`;
    }

    if (hasOperator(raw)) {
      return "= —";
    }

    const formatted = numberFormatting.formatForInput(raw);

    return formatted === "" ? `= ${placeholder}` : `= ${formatted}`;
  }, [expression, placeholder]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const filtered = toRawExpression(e.target.value);

      if (hasOperator(filtered)) {
        setIsExpressionMode(true);
        setExpression(filtered);
      } else {
        setIsExpressionMode(false);
        setExpression(filtered);
        onChange(filtered);
      }
    },
    [onChange]
  );

  const handleBackspace = useCallback(() => {
    const newExpression = expression.slice(0, -1);
    
    if (hasOperator(newExpression)) {
      setIsExpressionMode(true);
      setExpression(newExpression);
    } else {
      setIsExpressionMode(false);
      setExpression(newExpression);
      onChange(newExpression);
    }
  }, [expression, onChange]);

  const handleEvaluate = useCallback(() => {
    if (!hasOperator(expression)) {
      setShowKeyboard(false);
      return;
    }

    const result = safeEvaluate(expression);
    if (result !== null) {
      // Round to 2 decimal places for currency
      const rounded = Math.round(result * 100) / 100;
      const resultStr = rounded.toString();
      setExpression(resultStr);
      setIsExpressionMode(false);
      onChange(resultStr);
      setShowKeyboard(false);
    }
  }, [expression, onChange]);

  const handleEvaluateRef = useRef(handleEvaluate);
  handleEvaluateRef.current = handleEvaluate;

  const showKeyboardRef = useRef(showKeyboard);
  showKeyboardRef.current = showKeyboard;

  const isCalculatorKeyboardTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) {
      return false;
    }

    return (
      containerRef.current?.contains(target) === true
      || keyboardRef.current?.contains(target) === true
    );
  }, []);

  const handleEnterAsEquals = useCallback(
    (event: KeyboardEvent | React.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if ("stopImmediatePropagation" in event) {
        event.stopImmediatePropagation();
      }

      handleEvaluateRef.current();
    },
    [],
  );

  const handleButtonClick = useCallback(
    (btn: string) => {
      // Handle special buttons
      if (btn === "C") {
        setExpression("");
        setIsExpressionMode(false);
        onChange("");
        return;
      }

      if (btn === "⌫") {
        handleBackspace();
        return;
      }

      if (btn === "=") {
        handleEvaluate();
        return;
      }

      if (btn === "%") {
        // Convert current value to percentage (divide by 100)
        const currentValue = safeEvaluate(expression);
        if (currentValue !== null) {
          const percentValue = currentValue / 100;
          const resultStr = percentValue.toString();
          setExpression(resultStr);
          setIsExpressionMode(false);
          onChange(resultStr);
        }
        return;
      }

      // Handle +/- toggle
      if (btn === "±") {
        if (expression.startsWith("-")) {
          const newExpression = expression.slice(1);
          setExpression(newExpression);
          if (!hasOperator(newExpression)) {
            setIsExpressionMode(false);
            onChange(newExpression);
          }
        } else {
          const newExpression = "-" + expression;
          setExpression(newExpression);
          if (!hasOperator(newExpression)) {
            setIsExpressionMode(false);
            onChange(newExpression);
          }
        }
        return;
      }

      // Map display operators to actual operators
      const actualBtn = OPERATOR_MAP[btn] || btn;
      const newExpression = expression + actualBtn;
      
      if (hasOperator(newExpression)) {
        setIsExpressionMode(true);
        setExpression(newExpression);
      } else {
        setIsExpressionMode(false);
        setExpression(newExpression);
        onChange(newExpression);
      }
    },
    [expression, onChange, handleBackspace, handleEvaluate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isCalculatorEnterKey(e) && showKeyboard) {
        handleEnterAsEquals(e);
        return;
      }

      if (e.key === "Escape") {
        if (isExpressionMode) {
          setIsExpressionMode(false);
          setExpression(value);
        }
        setShowKeyboard(false);
      }
    },
    [
      handleEnterAsEquals,
      isExpressionMode,
      showKeyboard,
      value,
    ],
  );

  // Capture Enter before it reaches <form> implicit submit (same as pressing "=").
  useEffect(() => {
    if (!showKeyboard || disabled) {
      return;
    }

    const handleDocumentEnter = (event: KeyboardEvent) => {
      if (!isCalculatorEnterKey(event)) {
        return;
      }

      if (!isCalculatorKeyboardTarget(event.target)) {
        return;
      }

      handleEnterAsEquals(event);
    };

    document.addEventListener("keydown", handleDocumentEnter, true);

    return () => {
      document.removeEventListener("keydown", handleDocumentEnter, true);
    };
  }, [
    disabled,
    handleEnterAsEquals,
    isCalculatorKeyboardTarget,
    showKeyboard,
  ]);

  useEffect(() => {
    if (!showKeyboard || disabled) {
      return;
    }

    const input = inputRef.current;
    const form = input?.closest("form");

    if (!form) {
      return;
    }

    const preventSubmitWhileCalculating = (event: SubmitEvent) => {
      if (!showKeyboardRef.current) {
        return;
      }

      const activeElement = document.activeElement;

      if (
        activeElement !== input
        && !isCalculatorKeyboardTarget(activeElement)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleEvaluateRef.current();
    };

    form.addEventListener("submit", preventSubmitWhileCalculating, true);

    return () => {
      form.removeEventListener("submit", preventSubmitWhileCalculating, true);
    };
  }, [
    disabled,
    isCalculatorKeyboardTarget,
    showKeyboard,
  ]);

  const openKeyboard = useCallback(() => {
    if (disabled) {
      return;
    }

    const input = inputRef.current;

    if (!input) {
      return;
    }

    applyKeyboardPlacement(input);
    setShowKeyboard(true);
    requestAnimationFrame(collapseSelectionToEnd);
  }, [applyKeyboardPlacement, collapseSelectionToEnd, disabled]);

  const handleFocus = useCallback(() => {
    openKeyboard();
  }, [openKeyboard]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }

      // Mobile sheets can swallow click-before-focus; open keyboard on pointer down.
      e.stopPropagation();
      openKeyboard();
    },
    [disabled, openKeyboard],
  );

  const handleCalculatorButtonPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus({ preventScroll: true });
    },
    [],
  );

  const isOperatorButton = (btn: string) => ["+", "−", "×", "÷", "="].includes(btn);
  const isActionButton = (btn: string) => ["⌫", "C", "%"].includes(btn);

  const isBottomSheetKeyboard = keyboardLayout === "bottom-sheet";
  const isFloatingDesktopKeyboard = keyboardLayout === "floating";
  const isCompactDesktopKeyboard =
    !isMobile
    && (isFloatingDesktopKeyboard || keyboardLayout === "below" || keyboardLayout === "above");
  const mobileNavInsetMinHeightPx = resolveMobileNavInsetMinHeightPx(
    isMobile,
    hasAndroid3ButtonNav,
  );

  // Render the calculator keyboard content
  const renderKeyboard = () => (
    <div
      ref={keyboardRef}
      data-calculator-keyboard
      className={cn(
        "z-[9999] pointer-events-auto bg-background shadow-2xl",
        isBottomSheetKeyboard
          ? "fixed bottom-0 left-0 right-0 flex flex-col border-t rounded-t-xl"
          : cn(
              "fixed h-auto rounded-xl border p-3",
              isFloatingDesktopKeyboard && "max-w-[min(100vw-2rem,18rem)]",
            ),
      )}
      style={
        isBottomSheetKeyboard
          ? {
              paddingBottom: mobileNavInsetMinHeightPx,
            }
          : {
              top: keyboardPosition.top,
              bottom: keyboardPosition.bottom,
              left: keyboardPosition.left,
              width: keyboardPosition.width,
              maxWidth: isFloatingDesktopKeyboard
                ? `min(calc(100vw - 2rem), ${DESKTOP_KEYBOARD_WIDTH}px)`
                : undefined,
              ...(isCompactDesktopKeyboard
                ? { minHeight: DESKTOP_KEYBOARD_MIN_HEIGHT }
                : { height: keyboardPosition.height }),
            }
      }
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex flex-col",
          isBottomSheetKeyboard
            ? "gap-2.5 p-3"
            : isCompactDesktopKeyboard
              ? "gap-2"
              : "h-full min-h-0 gap-2",
        )}
      >
        <div
          className={cn(
            "shrink-0 rounded-lg border bg-muted/30 px-3 py-2",
            !isBottomSheetKeyboard && "mb-1",
          )}
        >
          <p
            className={cn(
              "truncate text-right font-semibold tabular-nums text-primary",
              isBottomSheetKeyboard
                ? "text-2xl sm:text-3xl"
                : isCompactDesktopKeyboard
                  ? "text-xl"
                  : "text-xl sm:text-2xl",
            )}
            aria-live="polite"
          >
            {keyboardDisplayValue}
          </p>
          <p
            className="min-h-5 truncate text-right text-sm leading-5 tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {keyboardPreviewLine}
          </p>
        </div>

        {/* Calculator buttons - iOS style layout */}
        <div
          className={cn(
            "grid grid-cols-4",
            isBottomSheetKeyboard
              ? MOBILE_CALC_GRID_GAP_CLASS
              : cn(
                  "grid-rows-5 gap-1.5",
                  isCompactDesktopKeyboard ? "shrink-0" : "min-h-0 flex-1",
                ),
          )}
        >
          {CALCULATOR_BUTTONS.flat().map((btn, index) => (
            <Button
              key={`${btn}-${index}`}
              type="button"
              data-calculator-keyboard-button=""
              variant={isOperatorButton(btn) ? "secondary" : isActionButton(btn) ? "secondary" : "outline"}
              className={cn(
                "touch-manipulation [-webkit-tap-highlight-color:transparent] font-semibold",
                "transition-colors duration-100 ease-out",
                "active:bg-primary active:text-primary-foreground active:border-primary",
                isBottomSheetKeyboard
                  ? cn(MOBILE_CALC_BUTTON_ROW_CLASS, "text-lg")
                  : isCompactDesktopKeyboard
                    ? "h-11 min-h-11 w-full text-base"
                    : "h-full min-h-11 text-lg",
                // Operators column (right side) - primary/orange color
                isOperatorButton(btn) && "bg-primary/10 hover:bg-primary/20 text-primary",
                // Action buttons (top row except ÷) - muted style
                isActionButton(btn) && "bg-muted hover:bg-muted/80 text-muted-foreground",
                // Plus/minus toggle - orange accent
                btn === "±" && "bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400"
              )}
              onPointerDown={handleCalculatorButtonPointerDown}
              onMouseDown={handleCalculatorButtonPointerDown}
              onClick={() => {
                handleButtonClick(btn);
                requestAnimationFrame(collapseSelectionToEnd);
              }}
            >
              {btn}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      data-calculator-input
      className="relative w-full"
    >
      {/* Input field */}
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="none"
        value={displayExpression}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full tabular-nums text-xl font-semibold text-primary sm:text-2xl md:text-sm md:font-normal",
          isExpressionMode && "ring-2 ring-primary/50",
          className
        )}
      />

      {/* Calculator keyboard - rendered via portal to avoid clipping */}
      {mounted && showKeyboard && !disabled && createPortal(
        renderKeyboard(),
        getNestedOverlayPortalRoot() ?? document.body,
      )}
    </div>
  );
}
