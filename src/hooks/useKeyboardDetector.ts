"use client";

import { useEffect, useState } from "react";

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
      
      // Get visual viewport height (the actually visible area)
      const visualHeight = vv != null && Number.isFinite(vv.height) 
        ? vv.height 
        : layoutHeight;
      
      // Calculate difference between layout and visual viewport
      const heightDiff = layoutHeight - visualHeight;
      
      // Keyboard is likely open if:
      // 1. Visual viewport is significantly smaller than layout viewport (>150px difference)
      // 2. Visual viewport height is small (< 400px typical for mobile with keyboard)
      const isKeyboardOpen = heightDiff > KEYBOARD_HEIGHT_THRESHOLD_PX || 
                             (visualHeight < SMALL_VIEWPORT_HEIGHT_PX && layoutHeight > SMALL_VIEWPORT_HEIGHT_PX);

      setState({
        isOpen: isKeyboardOpen,
        visualViewportHeight: Math.round(visualHeight),
        layoutViewportHeight: layoutHeight,
        heightDifference: Math.round(heightDiff),
      });
    };

    // Initial detection
    detectKeyboard();

    // Listen for viewport changes
    const vv = window.visualViewport;
    
    const handleResize = () => {
      // Small delay to let viewport settle
      requestAnimationFrame(detectKeyboard);
    };

    vv?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      vv?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return state;
}
