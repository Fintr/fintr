/**
 * Soft keyboard height (px) from `@capacitor/keyboard` on native apps.
 * On iOS WKWebView, `window.visualViewport` often stays near `innerHeight` while the
 * keyboard overlays the WebView (especially with a custom webView frame). This
 * value is the reliable fallback for modal sizing.
 */

let keyboardInsetPx = 0;

const insetListeners = new Set<() => void>();

let bridgeAttached = false;

export function getCapacitorKeyboardInsetPx(): number {
  return keyboardInsetPx;
}

export function subscribeCapacitorKeyboardInset(listener: () => void): () => void {
  insetListeners.add(listener);

  return () => {
    insetListeners.delete(listener);
  };
}

function notifyInsetListeners() {
  insetListeners.forEach((listener) => {
    listener();
  });
}

function setKeyboardInsetPx(px: number) {
  const next =
    Number.isFinite(px) && px > 0
      ? Math.round(px)
      : 0;

  if (next === keyboardInsetPx) {
    return;
  }

  keyboardInsetPx = next;
  notifyInsetListeners();
}

/**
 * Registers Capacitor Keyboard listeners once. Safe to call from the client on web
 * (no-op when not on a native platform).
 */
export function initCapacitorKeyboardInsetBridge(): void {
  if (typeof window === "undefined" || bridgeAttached) {
    return;
  }

  void (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");

      if (!Capacitor.isNativePlatform()) {
        return;
      }

      const { Keyboard } = await import("@capacitor/keyboard");

      bridgeAttached = true;

      await Keyboard.addListener(
        "keyboardWillShow",
        (info) => {
          setKeyboardInsetPx(info.keyboardHeight ?? 0);
        }
      );
      await Keyboard.addListener(
        "keyboardDidShow",
        (info) => {
          setKeyboardInsetPx(info.keyboardHeight ?? 0);
        }
      );
      await Keyboard.addListener(
        "keyboardWillHide",
        () => {
          setKeyboardInsetPx(0);
        }
      );
      await Keyboard.addListener(
        "keyboardDidHide",
        () => {
          setKeyboardInsetPx(0);
        }
      );
    } catch {
      bridgeAttached = false;
    }
  })();
}
