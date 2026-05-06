"use client";

import React, { type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import Providers from "@/lib/providers";
import { PerformanceMonitor } from "@/components/performance-monitor";
import CapacitorLoader from "@/components/capacitor-loader";
import CacheVersionChecker from "@/components/cache-version-checker";
import ErudaDevTools from "@/components/eruda-devtools";

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
    console.error("[GlobalErrorBoundary]", error, errorInfo);
    // Capture error with Sentry including component stack
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        component: "GlobalErrorBoundary",
      },
    });
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Unknown error";
      const errorStack = this.state.error?.stack || "";
      
      return (
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#fafaf9'
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>
            Critical Error
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '400px', textAlign: 'center' }}>
            {errorMsg}
          </p>
          <pre style={{
            fontSize: '12px',
            backgroundColor: '#f1f1f1',
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
      <CacheVersionChecker />
      <ErudaDevTools />
      <PerformanceMonitor>
        <Providers>
          {children}
        </Providers>
      </PerformanceMonitor>
    </GlobalErrorBoundary>
  );
}
