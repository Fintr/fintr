/**
 * Hex colors for native shells (Android/iOS status bar, splash, safe-area fills).
 * Keep in sync with `:root` / `.dark` CSS variables in globals.css.
 */
export type AppAppearance = "light" | "dark";

export const THEME_COLORS = {
  light: {
    background: "#FAFAF8",
    primary: "#0A3D62",
    card: "#FFFFFF",
    splash: "#FAFAF8",
  },
  dark: {
    background: "#151921",
    primary: "#0A3D62",
    card: "#1e2433",
    splash: "#151921",
  },
} as const;

export function getThemeChromeColors(appearance: AppAppearance) {
  return THEME_COLORS[appearance];
}
