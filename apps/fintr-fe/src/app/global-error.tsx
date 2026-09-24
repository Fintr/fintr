"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  canRecoverOfflineChunkNavigation,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/utils/chunkLoadError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const isChunkError = isChunkLoadError(error);
  const isStaleChunkError = isChunkError && !isOffline;
  const hideOfflineChunkDump =
    isChunkError && (isOffline || canRecoverOfflineChunkNavigation());

  useEffect(() => {
    if (isChunkError) {
      recoverFromChunkLoadError(error);
      return;
    }

    console.error("[GlobalError] Root layout error:", error);
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
        component: "GlobalError",
      },
    });
  }, [error, isChunkError]);

  if (hideOfflineChunkDump) {
    return (
      <html lang="en">
        <body style={{ margin: 0, backgroundColor: "#fafaf9" }} />
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#151921",
          color: "#f8fafc",
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "16px" }}>
          Critical Error
        </h1>
        <p
          style={{
            color: "#94a3b8",
            marginBottom: "16px",
            maxWidth: "400px",
            textAlign: "center",
          }}
        >
          {isStaleChunkError
            ? "A new version of Fintr is available. Reload the page to continue."
            : error.message || "A critical error occurred while loading the app"}
        </p>
        {error.digest && !isStaleChunkError && (
          <p style={{ fontSize: "12px", color: "#999", marginBottom: "16px" }}>
            Error ID: {error.digest}
          </p>
        )}
        {!isStaleChunkError && (
          <pre
            style={{
              fontSize: "12px",
              backgroundColor: "#f1f1f1",
              padding: "16px",
              borderRadius: "8px",
              maxWidth: "90%",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "200px",
              marginBottom: "24px",
            }}
          >
            {error.stack || "No stack trace available"}
          </pre>
        )}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => {
              if (isStaleChunkError) {
                window.location.reload();
                return;
              }

              reset();
            }}
            style={{
              padding: "12px 24px",
              backgroundColor: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {isStaleChunkError ? "Reload app" : "Try Again"}
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 24px",
              backgroundColor: "transparent",
              color: "#0f172a",
              border: "1px solid #0f172a",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
