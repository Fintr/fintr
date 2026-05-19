"use client";

import { useEffect } from "react";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/utils/chunkLoadError";

function handleChunkScriptError(event: Event): void {
  const target = event.target;

  if (!(target instanceof HTMLScriptElement)) {
    return;
  }

  if (!target.src.includes("/_next/static/chunks/")) {
    return;
  }

  event.preventDefault();
  recoverFromChunkLoadError(
    new Error(`Loading chunk script failed: ${target.src}`),
  );
}

/**
 * Recovers from stale Next.js bundles after a deployment by reloading once.
 */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      const error = event.error ?? new Error(event.message);

      if (!isChunkLoadError(error)) {
        return;
      }

      event.preventDefault();
      recoverFromChunkLoadError(error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) {
        return;
      }

      event.preventDefault();
      recoverFromChunkLoadError(event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleChunkScriptError, true);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleChunkScriptError, true);
    };
  }, []);

  return null;
}
