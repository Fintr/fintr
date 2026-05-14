"use client";

import { useEffect, useState } from "react";
import { subscribeCapacitorKeyboardInset } from "@/lib/capacitor-keyboard-inset";
import { getMobileModalViewportHeight } from "@/lib/mobile-modal-viewport-height";

/**
 * Keeps full-screen modal max-height in sync with the visible viewport on native
 * WebViews (keyboard show/hide, orientation changes). Returns null when the modal is closed.
 */
export function useMobileModalViewportHeight(isOpen: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setHeight(null);

      return;
    }

    const sync = () => {
      setHeight(getMobileModalViewportHeight());
    };

    sync();

    const vv = window.visualViewport;

    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    const unsubInset = subscribeCapacitorKeyboardInset(sync);

    return () => {
      unsubInset();
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [isOpen]);

  return height;
}
