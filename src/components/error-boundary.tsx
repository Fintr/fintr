"use client";

import React, { type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

/**
 * Catches render errors so Capacitor / simulator never shows an empty white screen
 * without any clue (common when a child component throws).
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  getErrorDetails(): string {
    const details: string[] = [];
    
    // Get early errors captured before React loaded
    if (typeof window !== "undefined" && (window as any).__earlyErrors?.length > 0) {
      details.push("=== Early Errors (before React) ===");
      (window as any).__earlyErrors.forEach((err: any) => {
        details.push(`[${new Date(err.timestamp).toISOString()}] ${err.type || 'Error'}: ${err.message || err.reason}`);
        if (err.filename) details.push(`  at ${err.filename}:${err.lineno}:${err.colno}`);
      });
      details.push("");
    }
    
    // Add the caught error
    if (this.state.error) {
      details.push("=== React Error ===");
      details.push(`${this.state.error.name}: ${this.state.error.message}`);
      details.push(this.state.error.stack || "");
    }
    
    // Add component stack
    if (this.state.errorInfo?.componentStack) {
      details.push("");
      details.push("=== Component Stack ===");
      details.push(this.state.errorInfo.componentStack);
    }
    
    return details.join("\n");
  }

  render() {
    if (this.state.hasError) {
      const errorDetails = this.getErrorDetails();
      const isDev = process.env.NODE_ENV === "development";
      
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"
          style={{
            backgroundColor: "var(--background, #fafaf9)",
            color: "var(--foreground, #0f172a)",
          }}
        >
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error?.message || "Unknown error"}
          </p>
          
          {/* Show error details in development or for reporting */}
          <div className="max-w-full overflow-auto rounded-md bg-gray-100 p-4 text-left text-xs">
            <pre className="whitespace-pre-wrap break-all">{errorDetails}</pre>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
            <button
              type="button"
              className="rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary"
              onClick={() => {
                const text = errorDetails;
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text).then(() => {
                    alert("Error details copied to clipboard!");
                  });
                }
              }}
            >
              Copy Error Details
            </button>
          </div>
          
          {!isDev && (
            <p className="text-xs text-muted-foreground">
              If this persists, please contact support with the error details above.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
