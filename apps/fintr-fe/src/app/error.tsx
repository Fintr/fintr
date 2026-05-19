"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/utils/chunkLoadError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRecoveringFromStaleBuild, setIsRecoveringFromStaleBuild] =
    useState(false);
  const isStaleChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!isStaleChunkError) {
      return;
    }

    setIsRecoveringFromStaleBuild(true);
    recoverFromChunkLoadError(error);
  }, [error, isStaleChunkError]);

  useEffect(() => {
    if (isStaleChunkError) {
      return;
    }

    console.error("[GlobalError] Caught error:", error);
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
        component: "Error",
      },
    });
  }, [error, isStaleChunkError]);

  if (isRecoveringFromStaleBuild) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#fafaf9",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>
          Updating Fintr
        </h1>
        <p style={{ color: "#666", textAlign: "center" }}>
          Loading the latest version…
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#fafaf9",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "16px" }}>
        Something went wrong
      </h1>
      <p
        style={{
          color: "#666",
          marginBottom: "16px",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        {isStaleChunkError
          ? "A new version of Fintr is available. Reload the page to continue."
          : error.message || "An unexpected error occurred"}
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
            maxWidth: "100%",
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
    </div>
  );
}
