"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { resolveThemeForPath } from "@/lib/theme-routes";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = resolveThemeForPath(pathname);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme={forcedTheme}
      enableSystem={false}
      disableTransitionOnChange
      storageKey="fintr-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
