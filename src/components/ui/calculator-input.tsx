"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Delete, Equal } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNativeCapacitor } from "@/lib/capacitor";

interface CalculatorInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CALCULATOR_BUTTONS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "±", "+"],
];

// Breakpoints for responsive behavior
const MOBILE_BREAKPOINT = 768; // md breakpoint

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
  // Check for operators, but ignore leading minus (negative number)
  // A value has an operator if it contains +, *, / anywhere,
  // or if it contains - NOT at the start (subtraction vs negative)
  if (/[+*/]/.test(value)) return true;
  // Check for minus that's not at the start (subtraction operator)
  const minusIndex = value.indexOf('-', 1); // Start searching from index 1
  return minusIndex > 0;
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
  const [keyboardPosition, setKeyboardPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle SSR - only render portal after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure the calculator keyboard doesn't cover Android 3-button navigation.
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const uaLower = ua.toLowerCase();
    const isAndroid = /android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isNative = isNativeCapacitor();
    const hasAndroidClass = document.documentElement.classList.contains("fintr-native-android");
    const hasIOSClass = document.documentElement.classList.contains("fintr-native-ios");
    setIsAndroidNative(isAndroid && (isNative || hasAndroidClass));
    setIsIOSNative(isIOS && (isNative || hasIOSClass));
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

  // Calculate keyboard position relative to input, keeping within viewport
  useEffect(() => {
    if (showKeyboard && inputRef.current && !isMobile) {
      const updatePosition = () => {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
          const keyboardWidth = Math.min(Math.max(rect.width, 280), 320);
          const viewportWidth = window.innerWidth;
          const padding = 16;
          
          // Calculate left position, ensuring keyboard stays within viewport
          let left = rect.left;
          
          // If keyboard would overflow right side, align to right edge of input
          if (left + keyboardWidth > viewportWidth - padding) {
            left = rect.right - keyboardWidth;
          }
          
          // If still overflowing left, clamp to left edge with padding
          if (left < padding) {
            left = padding;
          }
          
          setKeyboardPosition({
            top: rect.bottom + 8,
            left: left,
            width: keyboardWidth,
          });
        }
      };
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [showKeyboard, isMobile]);

  // Sync with external value when not in expression mode
  useEffect(() => {
    if (!isExpressionMode) {
      setExpression(value);
    }
  }, [value, isExpressionMode]);

  // Handle clicks outside to close keyboard
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideKeyboard = keyboardRef.current?.contains(target);
      
      if (!clickedInsideContainer && !clickedInsideKeyboard) {
        setShowKeyboard(false);
        // Auto-evaluate on close if there's a valid expression
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
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expression, isExpressionMode, onChange, value]);

  const previewResult = hasOperator(expression) ? safeEvaluate(expression) : null;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Allow numbers, operators, decimal points, commas, and leading minus
      const filtered = newValue.replace(/[^0-9+\-*/.,]/g, "");
      
      if (hasOperator(filtered)) {
        // Enter expression mode - keep expression internal
        setIsExpressionMode(true);
        setExpression(filtered);
      } else {
        // No operators (may be a negative number like "-500") - pass through to parent
        setIsExpressionMode(false);
        setExpression(filtered);
        onChange(filtered);
      }
    },
    [onChange]
  );

  const handleButtonClick = useCallback(
    (btn: string) => {
      if (btn === "C") {
        setExpression("");
        setIsExpressionMode(false);
        onChange("");
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

      const newExpression = expression + btn;
      
      if (hasOperator(newExpression)) {
        setIsExpressionMode(true);
        setExpression(newExpression);
      } else {
        setIsExpressionMode(false);
        setExpression(newExpression);
        onChange(newExpression);
      }
    },
    [expression, onChange]
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
    if (!disabled) {
      setShowKeyboard(true);
    }
  }, [disabled]);

  const isOperatorButton = (btn: string) => ["+", "-", "*", "/"].includes(btn);

  // Render the calculator keyboard content
  const renderKeyboard = () => (
    <div
      ref={keyboardRef}
      className={cn(
        "bg-background border shadow-2xl z-[9999]",
        isMobile 
          ? "fixed left-0 right-0 bottom-0 border-t rounded-t-xl p-3" 
          : "fixed rounded-xl p-4"
      )}
      style={
        isMobile
          ? {
              maxHeight: "50vh",
              // Sit above the Android navigation bar area or iOS safe area.
              bottom: isAndroidNative
                ? "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))"
                : isIOSNative
                  ? "env(safe-area-inset-bottom, 0px)"
                  : undefined,
            }
          : {
        top: keyboardPosition.top,
        left: keyboardPosition.left,
        width: keyboardPosition.width,
      }
      }
    >
      <div className="space-y-2">
        {/* Expression display with result preview */}
        {(expression || previewResult !== null) && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className={cn(
              "font-mono text-right break-all font-semibold",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {expression || "0"}
            </p>
            {previewResult !== null && (
              <p className={cn(
                "text-muted-foreground text-right",
                isMobile ? "text-sm" : "text-base"
              )}>
                = {previewResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )}

        {/* Calculator buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {CALCULATOR_BUTTONS.flat().map((btn) => (
            <Button
              key={btn}
              type="button"
              variant={isOperatorButton(btn) ? "secondary" : btn === "±" ? "secondary" : "outline"}
              className={cn(
                "font-semibold",
                isMobile ? "h-11 text-lg" : "h-12 text-xl",
                isOperatorButton(btn) && "bg-primary/10 hover:bg-primary/20 text-primary",
                btn === "±" && "bg-orange-100 hover:bg-orange-200 text-orange-700"
              )}
              onClick={() => handleButtonClick(btn)}
            >
              {btn}
            </Button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="destructive"
            className={cn("px-3", isMobile ? "h-10 text-base" : "h-11 text-lg")}
            onClick={() => handleButtonClick("C")}
          >
            C
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("flex-1", isMobile ? "h-10 text-base" : "h-11 text-lg")}
            onClick={handleBackspace}
          >
            <Delete className={cn(isMobile ? "h-4 w-4 mr-1" : "h-5 w-5 mr-1.5")} />
            Del
          </Button>
          <Button
            type="button"
            className={cn("flex-1 bg-primary hover:bg-primary/90", isMobile ? "h-10 text-base" : "h-11 text-lg")}
            onClick={handleEvaluate}
          >
            <Equal className={cn(isMobile ? "h-4 w-4 mr-1" : "h-5 w-5 mr-1.5")} />
            Done
          </Button>
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
        value={expression}
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
