"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prefetch list → detail hrefs (including query ids) while online so offline
 * client navigations can hit a cached payload instead of the empty shell.
 */
export const usePrefetchDetailHrefs = (hrefs: string[] | undefined): void => {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    if (!hrefs?.length) {
      return;
    }

    for (const href of hrefs) {
      router.prefetch(href);
    }
  }, [hrefs, router]);
};
