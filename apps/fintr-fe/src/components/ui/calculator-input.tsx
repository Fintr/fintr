"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNativeCapacitor } from "@/lib/capacitor";
import { getSafeAreaInsets } from "@/lib/platform-detection";
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen";
import { numberFormatting } from "@/lib/utils";

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
const DESKTOP_KEYBOARD_HEIGHT = 320;

const CALCULATOR_KEYBOARD_HISTORY_KEY = "__fintrCalculatorKeyboard";

type KeyboardLayout = "below" | "above" | "bottom-sheet";

type KeyboardPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const parsePxOffset = (value: string): number => {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? 0 : parsed;
};

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

function toRawExpression(value: string): string {
  return numberFormatting.stripDelimiters(value).replace(/[^0-9+\-*/.]/g, "");
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
  const [isAndroidNative, setIsAndroidNative] = useState(false);
  const [isIOSNative, setIsIOSNative] = useState(false);
  const [keyboardPosition, setKeyboardPosition] = useState<KeyboardPosition>({
    top: 0,
    left: 0,
    width: 0,
    height: DESKTOP_KEYBOARD_HEIGHT,
  });
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>("below");
  const [keyboardBottomOffset, setKeyboardBottomOffset] = useState<string>("0px");
  const [mounted, setMounted] = useState(false);
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

  // Detect platform and calculate bottom offset for safe area / navigation bar
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const uaLower = ua.toLowerCase();
    const isAndroid = /android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isNative = isNativeCapacitor();
    const hasAndroidClass = document.documentElement.classList.contains("fintr-native-android");
    const hasIOSClass = document.documentElement.classList.contains("fintr-native-ios");
    const androidNative = isAndroid && (isNative || hasAndroidClass);
    const iosNative = isIOS && (isNative || hasIOSClass);
    setIsAndroidNative(androidNative);
    setIsIOSNative(iosNative);

    // Calculate bottom offset to avoid system navigation overlap.
    // Android native needs extra lift for 3-button navigation.
    // iOS native should sit flush at the modal bottom to avoid double-spacing.
    if (androidNative) {
      const insets = getSafeAreaInsets();
      const minNavHeight = 48;
      const navHeight = Math.max(insets.bottom, minNavHeight);
      const cappedNavHeight = Math.min(navHeight, 80);
      setKeyboardBottomOffset(`${cappedNavHeight}px`);
    } else if (iosNative) {
      setKeyboardBottomOffset("0px");
    }
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

  const prefersBottomSheetKeyboard = useCallback(() => {
    const input = inputRef.current;

    if (!input) {
      return false;
    }

    if (isMobile) {
      return true;
    }

    return (
      input.closest("[data-modal-content]") != null
      || input.closest('[role="dialog"]') != null
    );
  }, [isMobile]);

  const updateKeyboardPosition = useCallback(() => {
    const input = inputRef.current;
    const rect = input?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 16;
    const keyboardHeight = isMobile
      ? viewportHeight * MOBILE_KEYBOARD_VH
      : DESKTOP_KEYBOARD_HEIGHT;
    const keyboardWidth = Math.min(
      Math.max(rect.width, 280),
      Math.min(320, viewportWidth - padding * 2),
    );

    if (prefersBottomSheetKeyboard()) {
      setKeyboardLayout("bottom-sheet");
      setKeyboardPosition({
        top: 0,
        left: 0,
        width: keyboardWidth,
        height: keyboardHeight,
      });

      if (typeof input.scrollIntoView === "function") {
        input.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      return;
    }

    let left = rect.left;

    if (left + keyboardWidth > viewportWidth - padding) {
      left = rect.right - keyboardWidth;
    }

    if (left < padding) {
      left = padding;
    }

    const bottomInset = parsePxOffset(keyboardBottomOffset);
    const spaceBelow = viewportHeight - rect.bottom - padding - bottomInset;
    const spaceAbove = rect.top - padding;

    const minAnchoredHeight = 260;

    if (spaceBelow >= minAnchoredHeight + KEYBOARD_GAP) {
      const anchoredHeight = Math.min(keyboardHeight, spaceBelow - KEYBOARD_GAP);

      setKeyboardLayout("below");
      setKeyboardPosition({
        top: rect.bottom + KEYBOARD_GAP,
        left,
        width: keyboardWidth,
        height: anchoredHeight,
      });
      return;
    }

    if (spaceAbove >= minAnchoredHeight + KEYBOARD_GAP) {
      const anchoredHeight = Math.min(keyboardHeight, spaceAbove - KEYBOARD_GAP);

      setKeyboardLayout("above");
      setKeyboardPosition({
        top: rect.top - anchoredHeight - KEYBOARD_GAP,
        left,
        width: keyboardWidth,
        height: anchoredHeight,
      });
      return;
    }

    setKeyboardLayout("bottom-sheet");
    setKeyboardPosition({
      top: 0,
      left: 0,
      width: keyboardWidth,
      height: keyboardHeight,
    });

    if (typeof input.scrollIntoView === "function") {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isMobile, keyboardBottomOffset, prefersBottomSheetKeyboard]);

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

  useCloseOnPopStateWhenOpen(
    showKeyboard && !disabled,
    handleKeyboardOverlayOpenChange,
    CALCULATOR_KEYBOARD_HISTORY_KEY,
  );

  // Handle clicks outside to close keyboard
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideKeyboard = target.closest("[data-calculator-keyboard]") != null;

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
      if (e.key === "Enter") {
        e.preventDefault();
        if (hasOperator(expression)) {
          handleEvaluate();
        } else {
          setShowKeyboard(false);
        }
      }
      if (e.key === "Escape") {
        if (isExpressionMode) {
          setIsExpressionMode(false);
          setExpression(value);
        }
        setShowKeyboard(false);
      }
    },
    [expression, handleEvaluate, isExpressionMode, value]
  );

  const handleFocus = useCallback(() => {
    if (disabled) {
      return;
    }

    setShowKeyboard(true);
    requestAnimationFrame(() => {
      collapseSelectionToEnd();
      updateKeyboardPosition();
      const element = inputRef.current;

      if (typeof element?.scrollIntoView === "function") {
        element.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
          inline: "nearest",
        });
      }
    });
  }, [disabled, collapseSelectionToEnd, updateKeyboardPosition]);

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

  // Render the calculator keyboard content
  const renderKeyboard = () => (
    <div
      ref={keyboardRef}
      data-calculator-keyboard
      className={cn(
        "bg-background border shadow-2xl z-[9999] pointer-events-auto",
        keyboardLayout === "bottom-sheet"
          ? "fixed left-0 right-0 border-t rounded-t-xl p-3"
          : "fixed rounded-xl border p-3 sm:p-4",
      )}
      style={
        keyboardLayout === "bottom-sheet"
          ? {
              height: `${MOBILE_KEYBOARD_VH * 100}vh`,
              bottom: keyboardBottomOffset,
            }
          : {
              top: keyboardPosition.top,
              left: keyboardPosition.left,
              width: keyboardPosition.width,
              height: keyboardPosition.height,
            }
      }
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "flex h-full flex-col",
          keyboardLayout === "bottom-sheet" ? "gap-1.5" : "gap-2",
        )}
      >
        <div
          className={cn(
            "shrink-0 rounded-lg border bg-muted/30 px-3 py-2",
            keyboardLayout === "bottom-sheet" ? "mb-0.5" : "mb-1",
          )}
        >
          <p
            className={cn(
              "truncate text-right font-semibold tabular-nums text-primary",
              keyboardLayout === "bottom-sheet"
                ? "text-2xl sm:text-3xl"
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
            "grid grid-cols-4 gap-1.5",
            keyboardLayout === "bottom-sheet" && "flex-1 grid-rows-5",
          )}
        >
          {CALCULATOR_BUTTONS.flat().map((btn, index) => (
            <Button
              key={`${btn}-${index}`}
              type="button"
              variant={isOperatorButton(btn) ? "secondary" : isActionButton(btn) ? "secondary" : "outline"}
              className={cn(
                "touch-manipulation [-webkit-tap-highlight-color:transparent] font-semibold",
                "transition-colors duration-100 ease-out",
                "active:bg-primary active:text-primary-foreground active:border-primary",
                keyboardLayout === "bottom-sheet"
                  ? "h-full min-h-11 text-lg"
                  : "h-11 text-lg sm:h-12 sm:text-xl",
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
    <div ref={containerRef} className="relative w-full">
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
        document.body
      )}
    </div>
  );
}
