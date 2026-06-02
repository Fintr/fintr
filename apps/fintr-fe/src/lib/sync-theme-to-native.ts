import type { AppAppearance } from "@/lib/theme-colors";
import { syncNativeAppearance } from "@/lib/native-appearance";

function scheduleNativeAppearanceSync(theme: AppAppearance): void {
  void syncNativeAppearance(theme);

  requestAnimationFrame(() => {
    void syncNativeAppearance(theme);
    requestAnimationFrame(() => {
      void syncNativeAppearance(theme);
    });
  });

  window.setTimeout(() => void syncNativeAppearance(theme), 0);
  window.setTimeout(() => void syncNativeAppearance(theme), 100);
}

/** Call when the user picks a theme — runs sync now and after DOM/storage settle. */
export function applyThemeWithNativeSync(
  setTheme: (theme: string) => void,
  theme: AppAppearance,
): void {
  setTheme(theme);
  scheduleNativeAppearanceSync(theme);
}

/** Re-sync an already-selected theme (e.g. from a MutationObserver). */
export function syncThemeToNative(theme: AppAppearance): void {
  scheduleNativeAppearanceSync(theme);
}
