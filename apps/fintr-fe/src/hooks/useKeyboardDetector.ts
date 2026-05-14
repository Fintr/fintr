"use client";

import { useEffect, useState } from "react";
import {
  getCapacitorKeyboardInsetPx,
  subscribeCapacitorKeyboardInset,
} from "@/lib/capacitor-keyboard-inset";

export interface KeyboardState {
  isOpen: boolean;
  visualViewportHeight: number;
  layoutViewportHeight: number;
  heightDifference: number;
}

const KEYBOARD_HEIGHT_THRESHOLD_PX = 150;
const SMALL_VIEWPORT_HEIGHT_PX = 400;

/**
 * Detects if the soft keyboard is likely open based on viewport dimensions.
 * 
 * On mobile devices, when the keyboard opens:
 * - visualViewport.height shrinks significantly
 * - The difference between layout viewport and visual viewport increases
 * - The visual viewport becomes "small" (typically < 400px on phones)
 * 
 * This is more reliable than input focus detection because it works across
 * all input types and handles edge cases like external keyboards.
 */
export function useKeyboardDetector(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    isOpen: false,
    visualViewportHeight: 0,
    layoutViewportHeight: 0,
    heightDifference: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectKeyboard = () => {
      const vv = window.visualViewport;
      const layoutHeight = window.innerHeight;
      const nativeKb = getCapacitorKeyboardInsetPx();

      // Get visual viewport height (the actually visible area)
      const visualHeight = vv != null && Number.isFinite(vv.height) 
        ? vv.height 
        : layoutHeight;
      
      // Calculate difference between layout and visual viewport
      const heightDiff = layoutHeight - visualHeight;
      
      // Keyboard is likely open if:
      // 1. Capacitor reported an open keyboard (iOS overlay WKWebView)
      // 2. Visual viewport is significantly smaller than layout viewport (>150px difference)
      // 3. Visual viewport height is small (< 400px typical for mobile with keyboard)
      const isKeyboardOpen =
        nativeKb > 0 ||
        heightDiff > KEYBOARD_HEIGHT_THRESHOLD_PX ||
        (visualHeight < SMALL_VIEWPORT_HEIGHT_PX &&
          layoutHeight > SMALL_VIEWPORT_HEIGHT_PX);

      setState({
        isOpen: isKeyboardOpen,
        visualViewportHeight: Math.round(visualHeight),
        layoutViewportHeight: layoutHeight,
        heightDifference: Math.round(heightDiff),
      });
    };

    // Initial detection
    detectKeyboard();

    // Listen for viewport changes. iOS WKWebView often fires `scroll` on visualViewport
    // when the keyboard shows or the visible rect shifts, without a separate `resize`.
    const vv = window.visualViewport;

    const handleResize = () => {
      requestAnimationFrame(detectKeyboard);
    };

    vv?.addEventListener("resize", handleResize);
    vv?.addEventListener("scroll", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const unsubInset = subscribeCapacitorKeyboardInset(() => {
      requestAnimationFrame(detectKeyboard);
    });

    return () => {
      unsubInset();
      vv?.removeEventListener("resize", handleResize);
      vv?.removeEventListener("scroll", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return state;
}
