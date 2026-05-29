"use client";

import React, { type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import Providers from "@/lib/providers";
import { PerformanceMonitor } from "@/components/performance-monitor";
import CapacitorLoader from "@/components/capacitor-loader";
import CacheVersionChecker from "@/components/cache-version-checker";
import ChunkLoadRecovery from "@/components/chunk-load-recovery";
import ErudaDevTools from "@/components/eruda-devtools";
import RackMiniProfilerPendingFlush from "@/components/rack-mini-profiler-pending-flush";
import RackMiniProfilerSpa from "@/components/rack-mini-profiler-spa";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/utils/chunkLoadError";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (recoverFromChunkLoadError(error)) {
      return;
    }

    console.error("[GlobalErrorBoundary]", error, errorInfo);
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        component: "GlobalErrorBoundary",
      },
    });
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const errorMsg = error?.message || "Unknown error";
      const errorStack = error?.stack || "";
      const isStaleChunkError = isChunkLoadError(error);

      return (
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: 'var(--background, #fafaf9)',
          color: 'var(--foreground, #0f172a)',
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>
            Critical Error
          </h1>
          <p style={{ color: 'var(--muted-foreground, #666666)', marginBottom: '24px', maxWidth: '400px', textAlign: 'center' }}>
            {isStaleChunkError
              ? "A new version of Fintr is available. Reload the page to continue."
              : errorMsg}
          </p>
          {!isStaleChunkError && (
          <pre style={{
            fontSize: '12px',
            backgroundColor: 'var(--muted, #f1f1f1)',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '100%',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '300px'
          }}>
            {errorStack}
          </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              backgroundColor: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <GlobalErrorBoundary>
      <CapacitorLoader />
      <ChunkLoadRecovery />
      <CacheVersionChecker />
      <ErudaDevTools />
      <RackMiniProfilerPendingFlush />
      <RackMiniProfilerSpa />
      <PerformanceMonitor>
        <Providers>
          {children}
        </Providers>
      </PerformanceMonitor>
    </GlobalErrorBoundary>
  );
}
