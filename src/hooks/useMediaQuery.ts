"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the viewport matches the given media query.
 * Uses 768px to align with the mobile breakpoint used for bottom nav / toaster.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
