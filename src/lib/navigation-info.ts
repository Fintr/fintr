/**
 * NavigationInfo plugin wrapper for Android native app.
 * Provides safe area and navigation type information from the Android layer.
 */

export type NavigationInfo = {
  navMode: number;
  is3ButtonNavigation: boolean;
  isGestureNavigation: boolean;
  platform: string;
  safeAreaTop?: number;
  safeAreaBottom?: number;
};

export type NavigationInfoResult =
  | { ok: true; value: NavigationInfo }
  | { ok: false; code: "unavailable" | "unexpected"; message: string };

export type SafeAreaResult = {
  applied: boolean;
  safeAreaTop: number;
  safeAreaBottom: number;
  is3ButtonNav: boolean;
};

export type SafeAreaClassesResult =
  | { ok: true; value: SafeAreaResult }
  | { ok: false; code: "unavailable" | "unexpected"; message: string };

/**
 * Get navigation information from the Android native layer.
 * Returns the navigation mode (3-button, 2-button, or gesture) and platform info.
 */
export async function getNavigationInfo(): Promise<NavigationInfoResult> {
  if (typeof window === 'undefined') {
    return { ok: false, code: "unavailable", message: "not in browser" };
  }

  const cap = (window as any).Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
    return { ok: false, code: "unavailable", message: "not native platform" };
  }

  // Try to use the plugin through Capacitor
  const plugins = cap.Plugins;
  if (!plugins || !plugins.NavigationInfo) {
    return { ok: false, code: "unavailable", message: "NavigationInfo plugin not available" };
  }

  try {
    const result = await plugins.NavigationInfo.getNavigationInfo();
    return {
      ok: true,
      value: {
        navMode: result.navMode,
        is3ButtonNavigation: result.is3ButtonNavigation,
        isGestureNavigation: result.isGestureNavigation,
        platform: result.platform,
        safeAreaTop: result.safeAreaTop,
        safeAreaBottom: result.safeAreaBottom,
      },
    };
  } catch (e) {
    console.error('[NavigationInfo] Error getting navigation info:', e);
    return { ok: false, code: "unexpected", message: String(e) };
  }
}

/**
 * Apply CSS classes for safe area handling from the Android native layer.
 * This calls the native Android code to inject CSS variables and apply
 * the appropriate classes (fintr-native-android, fintr-has-3btn-nav).
 * 
 * This is the preferred way to ensure safe area values are set correctly,
 * rather than relying on passive CSS variable injection.
 */
export async function applySafeAreaClasses(): Promise<SafeAreaClassesResult> {
  if (typeof window === 'undefined') {
    return { ok: false, code: "unavailable", message: "not in browser" };
  }

  const cap = (window as any).Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
    return { ok: false, code: "unavailable", message: "not native platform" };
  }

  // Try to use the plugin through Capacitor
  const plugins = cap.Plugins;
  if (!plugins || !plugins.NavigationInfo) {
    return { ok: false, code: "unavailable", message: "NavigationInfo plugin not available" };
  }

  try {
    const result = await plugins.NavigationInfo.applySafeAreaClasses();
    return { 
      ok: true, 
      value: {
        applied: result.applied,
        safeAreaTop: result.safeAreaTop,
        safeAreaBottom: result.safeAreaBottom,
        is3ButtonNav: result.is3ButtonNav,
      }
    };
  } catch (e) {
    console.error('[NavigationInfo] Error applying safe area classes:', e);
    return { ok: false, code: "unexpected", message: String(e) };
  }
}

/**
 * Initialize safe area handling for Android native app.
 * This should be called on app startup to ensure CSS variables are set.
 * Returns the navigation info after applying classes.
 */
export async function initializeSafeAreas(): Promise<NavigationInfoResult> {
  // First, try to apply the CSS classes via native call
  const applyResult = await applySafeAreaClasses();
  
  if (!applyResult.ok) {
    console.warn('[NavigationInfo] Failed to apply safe area classes via plugin, falling back to manual detection');
    
    // Fallback: manually apply classes based on CSS variables
    const bottomInset = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom').trim();
    const has3ButtonNav = bottomInset && parseInt(bottomInset) >= 40;
    
    document.documentElement.classList.add("fintr-native-android");
    if (has3ButtonNav) {
      document.documentElement.classList.add("fintr-has-3btn-nav");
    }
    
    console.log('[NavigationInfo] Manual fallback applied: bottomInset=' + bottomInset + ', has3ButtonNav=' + has3ButtonNav);
  } else {
    console.log('[NavigationInfo] Safe area classes applied via plugin:', applyResult.value);
  }
  
  // Then get the actual navigation info
  return getNavigationInfo();
}
