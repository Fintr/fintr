"use client";

import { shouldEnableRackMiniProfiler } from "@/lib/rack-mini-profiler-inline-bootstrap";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __FINTR_MP_PENDING_IDS?: string[];
    MiniProfiler?: {
      patchesApplied?: boolean;
      fetchResultsExposed?: (ids: string[]) => void;
      templates?: {
        profilerTemplate?: (json: unknown) => string;
      };
    };
  }
}

/**
 * After `vendor.js`, Mini Profiler exposes `templates` and `fetchResultsExposed`. Drain IDs
 * queued by {@link miniProfilerEarlyFetchQueueScript} (responses that arrived before the gem
 * patches `fetch`). Use the official API so `buttonShow` runs (click handlers, collapse rules).
 */
export default function RackMiniProfilerPendingFlush() {
  const flushedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!shouldEnableRackMiniProfiler()) return;

    if (!process.env.NEXT_PUBLIC_BE_URL) return;

    const tick = (): void => {
      const pending = window.__FINTR_MP_PENDING_IDS;
      if (!pending?.length) return;

      const mp = window.MiniProfiler;
      const container = document.querySelector(".profiler-results");
      const tpl = mp?.templates?.profilerTemplate;
      if (!container || typeof tpl !== "function") return;
      if (typeof mp?.fetchResultsExposed !== "function") return;

      const batch = pending.splice(0, pending.length);
      const ids = batch
        .map((raw) => raw.trim())
        .filter((id) => id.length > 0 && !flushedIds.current.has(id));

      for (const id of ids) {
        flushedIds.current.add(id);
      }

      if (ids.length > 0) {
        mp.fetchResultsExposed(ids);
      }
    };

    const handle = window.setInterval(tick, 150);
    return () => window.clearInterval(handle);
  }, []);

  return null;
}
