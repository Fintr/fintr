/**
 * Capacitor environment detection and utilities
 */

import { initCapacitorBridgeIfNeeded } from '@/lib/capacitor-bridge-init';

/**
 * Wait for Capacitor to be ready (if in Capacitor environment)
 * Also ensures Capacitor is fully initialized with all methods
 */
export const waitForCapacitor = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // If Capacitor is already available and has the expected methods, return true
  const capacitor = (window as any).Capacitor;
  if (capacitor && typeof capacitor.getPlatform === 'function') {
    return true;
  }

  // Wait for Capacitor to load (with timeout)
  return new Promise((resolve) => {
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();
    
    const checkCapacitor = () => {
      const cap = (window as any).Capacitor;
      
      // Check if Capacitor exists and has at least one method (indicating it's initialized)
      if (cap && typeof cap.getPlatform === 'function') {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        console.warn('Capacitor did not load within timeout period');
        resolve(false);
        return;
      }
      
      setTimeout(checkCapacitor, 100);
    };
    
    checkCapacitor();
  });
};

/**
 * Check if we're running in a Capacitor environment (Capacitor runtime present)
 * This is a synchronous check - use waitForCapacitor() if you need to ensure it's loaded
 */
export const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
};

/**
 * True when the request comes from the Fintr iOS/Android Capacitor WebView.
 * capacitor.config.ts appends "FintrNativeApp" to the user agent for both platforms.
 */
export const hasFintrNativeAppUserAgent = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return navigator.userAgent.includes('FintrNativeApp');
};

/**
 * Marketing homepage (fintr.ai `/`): redirect to /auth only inside the native app.
 * Regular browsers — including mobile Safari/Chrome — must always see the landing page.
 */
export const shouldRedirectHomeToAuth = (): boolean => hasFintrNativeAppUserAgent();

/**
 * Check if we're running as a native Capacitor app (iOS/Android), not in a browser.
 * Use this when choosing redirect URIs: only use fintrapp:// when this is true.
 * When Capacitor is loaded in a web build, getPlatform() is 'web' and we must use
 * the web redirect (e.g. https://fintr.ai/auth-callback or localhost).
 *
 * Detection strategy (in order of reliability):
 * 1. User-agent: capacitor.config.ts appends "FintrNativeApp" to the WebView UA for both
 *    iOS and Android. This is set by the native layer before any JS runs, so it is always
 *    reliable regardless of Capacitor bridge injection timing.
 * 2. window.Capacitor bridge (always works on iOS at document start; on Android this can
 *    arrive after page load via evaluateJavascript, so it may be absent initially).
 *
 * Do not treat generic Android WebView UAs ("; wv)") as native — that matches in-app
 * browsers and other WebViews loading https://fintr.ai and would incorrectly redirect
 * the marketing site to /auth.
 */
export const isNativeCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;

  if (hasFintrNativeAppUserAgent()) return true;

  const win = window as any;
  const cap = win.Capacitor;
  if (!cap) return false;

  const isNative =
    typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform() === true
      : false;
  const platform =
    typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';

  if (!isNative || (platform !== 'ios' && platform !== 'android')) {
    return false;
  }

  // Do not treat @capacitor/core in a normal browser as native. Require signals that
  // only exist in the Fintr native WebView (iOS injection or Android androidBridge).
  return (
    platform === 'ios'
    || Boolean(win.androidBridge || win.AndroidBridge)
  );
};

/**
 * Async version of isNativeCapacitor that waits for the Capacitor bridge to initialize
 * before checking. Use this in sign-in flows where you need a reliable answer before
 * opening the OAuth browser.
 *
 * If the synchronous UA check already returns true (FintrNativeApp in user-agent), we
 * skip the async bridge wait entirely — the UA is injected by the native layer before
 * any JS runs so it is always reliable and requires no polling delay.
 */
export const isNativeCapacitorAsync = async (): Promise<boolean> => {
  // Fast path: UA check is definitive and synchronous — no need to wait for bridge.
  if (isNativeCapacitor()) return true;
  // Slow path: bridge may not be injected yet (Android remote-URL mode).
  await waitForCapacitor();
  return isNativeCapacitor();
};

/**
 * Whether to show the "Simulate Payment" button (dev/staging only, never in production Capacitor).
 * Used for subscription management to hide simulate cycle payment in iOS/Android production builds.
 */
export const shouldShowSimulatePaymentButton = (): boolean => {
  const isDevOrStaging =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" &&
      (window.location.hostname.includes("staging") ||
        window.location.hostname.includes("localhost")));
  if (!isDevOrStaging) return false;
  if (isCapacitorEnvironment() && process.env.NODE_ENV === "production") return false;
  return true;
};

/**
 * Get the base URL for redirects based on the environment
 * - For Capacitor: returns 'fintrapp://'
 * - For browser: returns window.location.origin
 */
export const getBaseUrl = (): string => {
  if (isCapacitorEnvironment()) {
    return 'fintrapp://';
  }
  
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback for SSR
  return process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';
};

/**
 * Build a redirect URL for subscription callbacks
 * @param path - The path to append (e.g., '/dashboard/subscriptions?success=true')
 */
export const buildSubscriptionRedirectUrl = (path: string): string => {
  const baseUrl = getBaseUrl();
  
  // For Capacitor (fintrapp://), append path directly without leading slash
  if (baseUrl.endsWith('://')) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}${cleanPath}`;
  }
  
  // For browser URLs, ensure path starts with / and append to base URL
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Open a URL using the appropriate method based on environment
 * - For Capacitor: Uses in-app browser (Capacitor Browser plugin)
 * - For browser: Uses window.location.href or window.open
 * @param url - The URL to open
 * @param options - Options for opening the URL
 */
export const openUrl = async (
  url: string,
  options?: {
    inNewTab?: boolean;
    title?: string;
  }
): Promise<void> => {
  // Wait for Capacitor to be ready before checking
  const isCapacitor = await waitForCapacitor();
  
  if (isCapacitor) {
    try {
      initCapacitorBridgeIfNeeded();
      const { Browser } = await import('@capacitor/browser');
      
      await Browser.open({
        url: url,
        windowName: '_self',
        presentationStyle: 'fullscreen',
        toolbarColor: '#ffffff'
      });
    } catch (error) {
      console.error('Failed to open Capacitor browser:', error);
      // Fallback to regular browser if Capacitor Browser fails
      if (options?.inNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    }
  } else {
    // For regular browser
    if (options?.inNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }
};

