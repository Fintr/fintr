"use client";

import { useEffect, useState } from "react";

export interface VisualViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readVisualViewportRect(): VisualViewportRect {
  if (typeof window === "undefined") {
    return { top: 0, left: 0, width: 0, height: 0 };
  }

  const vv = window.visualViewport;
  if (vv == null) {
    return {
      top: 0,
      left: 0,
      width: Math.round(window.innerWidth),
      height: Math.round(window.innerHeight),
    };
  }

  const width = Math.max(1, Math.round(vv.width || window.innerWidth));
  const height = Math.max(1, Math.round(vv.height || window.innerHeight));

  return {
    top: Math.max(0, Math.round(vv.offsetTop)),
    left: Math.max(0, Math.round(vv.offsetLeft)),
    width,
    height,
  };
}

/**
 * Tracks the visible viewport rectangle (offset + size). On iOS WKWebView, when the
 * keyboard is shown, `visualViewport` can move relative to the layout viewport while
 * `position: fixed; inset: 0` stays layout-aligned — anchoring overlays to this rect
 * keeps modals aligned with what the user actually sees.
 */
export function useVisualViewportRect(enabled: boolean): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(() =>
    typeof window === "undefined"
      ? { top: 0, left: 0, width: 0, height: 0 }
      : readVisualViewportRect()
  );

  useEffect(() => {
    if (!enabled) {
      setRect(readVisualViewportRect());

      return;
    }

    const vv = window.visualViewport;
    if (vv == null) {
      return;
    }

    const sync = () => {
      setRect(readVisualViewportRect());
    };

    sync();

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [enabled]);

  return rect;
}
