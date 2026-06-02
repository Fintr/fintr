import type { AppAppearance } from "@/lib/theme-colors";
import { isLightThemePath } from "@/lib/theme-routes";

const FINTR_THEME_STORAGE_KEY = "fintr-theme";

/**
 * Resolve light/dark from storage + DOM (next-themes uses `class="dark"`, not `light`).
 * Prefer localStorage — it updates in the same tick as setTheme before class may settle.
 */
export function resolveAppearanceFromDom(pathname?: string): AppAppearance {
  if (typeof document === "undefined") return "dark";

  if (pathname && isLightThemePath(pathname)) return "light";

  try {
    const stored = localStorage.getItem(FINTR_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage may be unavailable
  }

  if (document.documentElement.classList.contains("dark")) return "dark";

  return "light";
}
