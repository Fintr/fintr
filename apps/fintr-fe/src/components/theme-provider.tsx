"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isLightThemePath } from "@/lib/theme-routes";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLightPath = isLightThemePath(pathname);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={isLightPath ? "light" : "dark"}
      forcedTheme={isLightPath ? "light" : undefined}
      enableSystem={false}
      disableTransitionOnChange
      storageKey="fintr-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
