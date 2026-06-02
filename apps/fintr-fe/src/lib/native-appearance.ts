import { Capacitor } from "@capacitor/core";
import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { Appearance } from "@/plugins/appearance";
import {
  getThemeChromeColors,
  type AppAppearance,
} from "@/lib/theme-colors";
import { resolveAppearanceFromDom } from "@/lib/resolve-appearance";

export type { AppAppearance };

type AppearanceCap = {
  Plugins?: {
    Appearance?: {
      setAppearance: (options: { theme: AppAppearance }) => Promise<void>;
    };
  };
  nativePromise?: (
    pluginName: string,
    methodName: string,
    options: unknown,
  ) => Promise<unknown>;
};

type FintrAppearanceBridge = {
  setTheme: (theme: string) => void;
  syncFromDom?: () => void;
};

function isAndroidNativeBridge(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as Window & {
    androidBridge?: unknown;
    AndroidBridge?: unknown;
  };
  return !!(win.androidBridge || win.AndroidBridge);
}

function getFintrAppearanceBridge(): FintrAppearanceBridge | undefined {
  return (window as Window & { FintrAppearance?: FintrAppearanceBridge })
    .FintrAppearance;
}

function ensureNativeBridgeReady(): void {
  if (isAndroidNativeBridge()) {
    initCapacitorBridgeIfNeeded();
  }
}

export function readStoredAppearance(pathname?: string): AppAppearance {
  return resolveAppearanceFromDom(pathname);
}

export function updateMetaThemeColor(appearance: AppAppearance): void {
  if (typeof document === "undefined") return;

  const { background } = getThemeChromeColors(appearance);
  let meta = document.querySelector('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", background);
}

function invokeViaJavascriptInterface(appearance: AppAppearance): boolean {
  const bridge = getFintrAppearanceBridge();
  if (!bridge?.setTheme) return false;

  try {
    bridge.setTheme(appearance);
    return true;
  } catch {
    return false;
  }
}

async function invokeNativeSetAppearance(
  appearance: AppAppearance,
): Promise<void> {
  if (invokeViaJavascriptInterface(appearance)) return;

  ensureNativeBridgeReady();

  const cap = (window as Window & { Capacitor?: AppearanceCap }).Capacitor;

  if (cap?.Plugins?.Appearance?.setAppearance) {
    await cap.Plugins.Appearance.setAppearance({ theme: appearance });
    return;
  }

  if (cap?.nativePromise && isAndroidNativeBridge()) {
    await cap.nativePromise("Appearance", "setAppearance", {
      theme: appearance,
    });
    return;
  }

  await Appearance.setAppearance({ theme: appearance });
}

export async function syncNativeAppearance(
  appearance: AppAppearance,
): Promise<void> {
  updateMetaThemeColor(appearance);

  if (!Capacitor.isNativePlatform()) return;

  try {
    await invokeNativeSetAppearance(appearance);
  } catch (error) {
    console.warn("[NativeAppearance] Failed to sync native chrome:", error);
  }
}

/** Read current DOM/storage theme and push to native chrome (Android FintrAppearance bridge). */
export async function syncNativeAppearanceFromDom(
  pathname?: string,
): Promise<void> {
  await syncNativeAppearance(resolveAppearanceFromDom(pathname));
}

/** Apply saved theme to native chrome as early as possible on app launch. */
export async function syncNativeAppearanceFromStorage(
  pathname?: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await syncNativeAppearanceFromDom(pathname);
}
