"use client";

import { useEffect, useState } from "react";
import { BOOTSTRAP_LOADING_MAX_MS } from "@/lib/bootstrap-loading";

export function useBootstrapLoadingTimeout(
  isLoading: boolean,
  maxMs: number = BOOTSTRAP_LOADING_MAX_MS,
) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, maxMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, maxMs]);

  return {
    timedOut,
    shouldBlock: isLoading && !timedOut,
  };
}
