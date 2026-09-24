"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Return `serverValue` on the server and during hydration, then read the
 * client store before paint. Prevents splash/dashboard HTML mismatches.
 */
export function useHydrationSafeValue<T>(read: () => T, serverValue: T): T {
  const [value, setValue] = useState(serverValue);
  const readRef = useRef(read);
  readRef.current = read;

  useLayoutEffect(() => {
    setValue(readRef.current());
  }, []);

  return value;
}
