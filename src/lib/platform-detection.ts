/**
 * Platform detection utilities for mobile-specific behaviors
 * Handles detection of Android native, iOS native, and browser mobile environments
 */

export interface PlatformDetectionResult {
  isAndroidNative: boolean
  isIOSNative: boolean
  isNative: boolean
  isMobileBrowser: boolean
  isAndroidBrowser: boolean
  isIOSBrowser: boolean
  safeAreaInsetBottom: number
  safeAreaInsetTop: number
}

/**
 * Detect platform based on user agent and CSS classes
 * This is the core detection logic used across the app
 */
export const detectPlatform = (
  userAgent: string = "",
  documentElement?: Element | null
): PlatformDetectionResult => {
  const ua = userAgent || ""
  const uaLower = ua.toLowerCase()

  const htmlElement = documentElement || null

  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isFintrNative = uaLower.includes("fintrnativeapp")
  const isWebView = /; wv\)/.test(ua)

  const hasAndroidClass =
    htmlElement?.classList.contains("fintr-native-android") ?? false
  const hasIOSClass =
    htmlElement?.classList.contains("fintr-native-ios") ?? false

  const isAndroidNative = isAndroid && (isFintrNative || isWebView || hasAndroidClass)
  const isIOSNative = isIOS && (isFintrNative || isWebView || hasIOSClass)
  const isNative = isAndroidNative || isIOSNative

  const isAndroidBrowser = isAndroid && !isNative
  const isIOSBrowser = isIOS && !isNative
  const isMobileBrowser = isAndroidBrowser || isIOSBrowser

  return {
    isAndroidNative,
    isIOSNative,
    isNative,
    isMobileBrowser,
    isAndroidBrowser,
    isIOSBrowser,
    safeAreaInsetBottom: 0,
    safeAreaInsetTop: 0,
  }
}

const parseCssPx = (value: string | undefined): number => {
  if (!value || value === "0px" || value === "0") return 0
  const parsed = parseFloat(value.replace("px", ""))
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Get safe area insets from CSS environment variables
 * Only works in browser environment
 */
export const getSafeAreaInsets = (): {
  bottom: number
  top: number
  left: number
  right: number
} => {
  if (typeof window === "undefined") {
    return { bottom: 0, top: 0, left: 0, right: 0 }
  }

  const styles = window.getComputedStyle(document.documentElement)

  const cssVarBottom = styles.getPropertyValue("--safe-area-inset-bottom").trim()
  const cssVarTop = styles.getPropertyValue("--safe-area-inset-top").trim()
  const cssVarLeft = styles.getPropertyValue("--safe-area-inset-left").trim()
  const cssVarRight = styles.getPropertyValue("--safe-area-inset-right").trim()

  let top = parseCssPx(cssVarTop)
  let bottom = parseCssPx(cssVarBottom)
  const left = parseCssPx(cssVarLeft)
  const right = parseCssPx(cssVarRight)

  // Android injects --safe-area-inset-* from native; iOS and mobile Safari often do not.
  // env() cannot be read from getComputedStyle(documentElement), so probe when vars are unset.
  if (
    (top === 0 || bottom === 0) &&
    typeof document !== "undefined" &&
    document.body
  ) {
    const fromEnv = readEnvSafeAreaInsetsFromProbe()
    if (top === 0) top = fromEnv.top
    if (bottom === 0) bottom = fromEnv.bottom
  }

  return {
    bottom,
    top,
    left,
    right,
  }
}

/**
 * Resolve env(safe-area-inset-*) for use in JS (e.g. hooks). CSS variables from
 * native are preferred; this fills gaps on iOS WebView and mobile browsers.
 */
const readEnvSafeAreaInsetsFromProbe = (): {
  top: number
  bottom: number
} => {
  if (typeof document === "undefined" || !document.body) {
    return { top: 0, bottom: 0 }
  }

  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top,0px)",
    "padding-bottom:env(safe-area-inset-bottom,0px)",
    "padding-left:0",
    "padding-right:0",
    "margin:0",
    "border:none",
    "width:0",
    "height:0",
  ].join(";")

  document.body.appendChild(probe)
  const computed = window.getComputedStyle(probe)
  const top = parseCssPx(computed.paddingTop)
  const bottom = parseCssPx(computed.paddingBottom)
  probe.remove()

  return { top, bottom }
}

/**
 * Calculate bottom padding for mobile layouts
 * Accounts for 3-button navigation on Android and safe areas on iOS
 *
 * Android 3-button nav requires minimum 48px for the navigation bar
 * iOS uses the safe area inset for home indicator
 * Mobile browsers need standard bottom padding
 */
/**
 * Calculate bottom padding for mobile layouts
 * Accounts for 3-button navigation on Android and safe areas on iOS
 *
 * Android 3-button nav requires minimum 48px for the navigation bar
 * iOS uses the safe area inset for home indicator
 * Mobile browsers need standard bottom padding
 *
 * NOTE: We cap the navigation height at 80px to prevent excessive padding
 * when the safe area inset reports unexpectedly large values (e.g., due to
 * keyboard open, screen rotation bugs, or certain Android OEM implementations)
 */
export const calculateBottomPadding = (
  isAndroidNative: boolean,
  isIOSNative: boolean,
  safeAreaInsetBottom: number
): string => {
  const MIN_ANDROID_NAV_HEIGHT = 48
  const MIN_IOS_NAV_HEIGHT = 16
  const MAX_NAV_HEIGHT = 80

  if (isAndroidNative) {
    // Clamp between minimum (48px) and maximum (80px) to prevent excessive padding
    const navHeight = Math.min(
      Math.max(safeAreaInsetBottom, MIN_ANDROID_NAV_HEIGHT),
      MAX_NAV_HEIGHT
    )
    return `calc(64px + ${navHeight}px)`
  }

  if (isIOSNative) {
    // Clamp between minimum (16px) and maximum (80px) to prevent excessive padding
    const navHeight = Math.min(
      Math.max(safeAreaInsetBottom, MIN_IOS_NAV_HEIGHT),
      MAX_NAV_HEIGHT
    )
    return `calc(64px + ${navHeight}px)`
  }

  // Mobile browsers use a fixed padding value
  return "80px"
}

/**
 * Calculate the bottom position for fixed navigation
 * Android shifts up for 3-button nav, others sit at bottom
 */
/**
 * Calculate the bottom position for fixed navigation
 * Android shifts up for 3-button nav, iOS shifts up for home indicator
 * Mobile browsers sit at bottom (handled by padding)
 *
 * NOTE: We cap the offset at 80px to prevent the navigation from shifting
 * too far up when the safe area inset reports unexpectedly large values
 */
export const calculateNavBottomOffset = (
  isAndroidNative: boolean,
  isIOSNative: boolean,
  safeAreaInsetBottom: number
): string | number => {
  const MIN_NAV_HEIGHT = 48
  const MAX_NAV_HEIGHT = 80

  // Android: shift up by safe area amount (3-button nav or gesture nav)
  if (isAndroidNative) {
    // Clamp between minimum (48px) and maximum (80px) to prevent excessive offset
    const navHeight = Math.min(
      Math.max(safeAreaInsetBottom, MIN_NAV_HEIGHT),
      MAX_NAV_HEIGHT
    )
    return `${navHeight}px`
  }

  // iOS: keep nav at bottom: 0; home indicator is handled once via pb-safe-bottom
  // on the nav (avoid bottom offset + padding double-counting).
  if (isIOSNative) {
    return 0
  }

  // Mobile browsers: sit at bottom (padding handles safe area)
  return 0
}

/**
 * Android WebView often reports no CSS env(safe-area-inset-top). MainActivity injects
 * `--safe-area-inset-top`; this floor avoids clipped headers if injection is late or zero.
 * iOS is unchanged (uses env() in calculateHeaderSpacerHeight).
 */
export const MIN_ANDROID_STATUS_BAR_INSET_PX = 24

export const resolveAndroidNativeTopInsetPx = (
  safeAreaInsetTop: number
): number => {
  return Math.max(safeAreaInsetTop, MIN_ANDROID_STATUS_BAR_INSET_PX)
}

/**
 * Calculate header spacer height for mobile (fixed header + scrollable body).
 * Uses CSS env(safe-area-inset-top) for iOS and mobile browsers so layout stays
 * correct when the WebView is full-bleed (native statusBarFrame can be 0 on newer iOS).
 * When the native layer already insets the WebView, env() is typically 0 — no double gap.
 */
export const calculateHeaderSpacerHeight = (
  isAndroidNative: boolean,
  _isIOSNative: boolean,
  safeAreaInsetTop: number
): string => {
  const baseHeight = 44

  // Android native: injected --safe-area-inset-top (see MainActivity) + minimum floor
  if (isAndroidNative) {
    const topPx = resolveAndroidNativeTopInsetPx(safeAreaInsetTop)
    return `calc(${baseHeight}px + ${topPx}px)`
  }

  // iOS native + mobile browsers: env() matches the real safe area in the web view
  return `calc(${baseHeight}px + env(safe-area-inset-top, 0px))`
}

/**
 * Complete platform detection with safe area insets
 * For use in browser environment only
 */
export const detectPlatformWithInsets = (): PlatformDetectionResult => {
  const baseDetection =
    typeof window !== "undefined"
      ? detectPlatform(navigator.userAgent, document.documentElement)
      : detectPlatform()

  const insets =
    typeof window !== "undefined" ? getSafeAreaInsets() : { bottom: 0, top: 0 }

  return {
    ...baseDetection,
    safeAreaInsetBottom: insets.bottom,
    safeAreaInsetTop: insets.top,
  }
}
