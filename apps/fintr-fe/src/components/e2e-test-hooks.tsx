"use client";

import { useEffect } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    __fintrE2e?: {
      showToast: (message: string) => void;
    };
  }
}

/**
 * Development-only hooks for Playwright e2e tests.
 */
export function E2eTestHooks() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    window.__fintrE2e = {
      showToast: (message: string) => {
        toast.success(message, { id: "e2e-test-toast" });
      },
    };

    return () => {
      delete window.__fintrE2e;
    };
  }, []);

  return null;
}
