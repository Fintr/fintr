import type { PluginListenerHandle } from "@capacitor/core";

import { isNativeCapacitor } from "@/lib/capacitor";

/**
 * Subscribe to Capacitor foreground resume. On iOS/Android, `visibilitychange` is
 * not always reliable when the WebView returns from the app switcher; `appStateChange`
 * is the native signal we already use for OAuth return flows.
 *
 * No-op on web builds.
 */
export const subscribeCapacitorAppResume = (
  onResume: () => void,
): (() => void) => {
  if (typeof window === "undefined" || !isNativeCapacitor()) {
    return () => {};
  }

  let cancelled = false;
  let listener: PluginListenerHandle | null = null;

  void import("@capacitor/app")
    .then(({ App }) => {
      if (cancelled) {
        return;
      }

      return App.addListener(
        "appStateChange",
        ({ isActive }: { isActive: boolean }) => {
          if (isActive) {
            onResume();
          }
        },
      );
    })
    .then((handle) => {
      if (!handle || cancelled) {
        void handle?.remove();
        return;
      }

      listener = handle;
    })
    .catch(() => {
      // @capacitor/app unavailable — web/PWA fallback uses visibilitychange only.
    });

  return () => {
    cancelled = true;
    void listener?.remove();
    listener = null;
  };
};
