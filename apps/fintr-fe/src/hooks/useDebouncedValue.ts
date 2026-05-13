"use client";

import { useEffect, useState } from "react";

/** Default delay for search / filter text before it drives queries or heavy work. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Returns `value` after it has stayed unchanged for `delayMs`.
 * Use for search boxes so typing does not trigger a network request on every keypress.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = globalThis.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => globalThis.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
