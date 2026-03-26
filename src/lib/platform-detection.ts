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
  hasAndroid3ButtonNav: boolean
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
    hasAndroid3ButtonNav: false,
  }
}

const parseCssPx = (value: string | undefined): number => {
  if (!value || value === "0px" || value === "0") return 0
  const parsed = parseFloat(value.replace("px", ""))
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Prefer values set via `document.documentElement.style.setProperty` (Android MainActivity)
 * so we read the latest inset immediately after native updates. `getComputedStyle` can lag
 * one frame behind orientation / IME on some WebViews.
 */
const readRootInsetCssVar = (name: string): string => {
  const html = document.documentElement
  const style = html.style as CSSStyleDeclaration | undefined
  const inline =
    typeof style?.getPropertyValue === "function"
      ? style.getPropertyValue(name).trim()
      : ""

  if (inline !== "") {
    return inline
  }

  return window.getComputedStyle(html).getPropertyValue(name).trim()
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

  const cssVarBottom = readRootInsetCssVar("--safe-area-inset-bottom")
  const cssVarTop = readRootInsetCssVar("--safe-area-inset-top")
  const cssVarLeft = readRootInsetCssVar("--safe-area-inset-left")
  const cssVarRight = readRootInsetCssVar("--safe-area-inset-right")

  let top = parseCssPx(cssVarTop)
  let bottom = parseCssPx(cssVarBottom)
  const left = parseCssPx(cssVarLeft)
  const right = parseCssPx(cssVarRight)

  const isAndroidNativeHtml =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("fintr-native-android")

  // Android injects --safe-area-inset-* from native; iOS and mobile Safari often do not.
  // env() cannot be read from getComputedStyle(documentElement), so probe when vars are unset.
  // Skip the env() probe on Android native: after rotation, env() can briefly disagree with
  // MainActivity's async `evaluateJavascript`, producing oversized top/bottom until the next resize.
  if (
    !isAndroidNativeHtml &&
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
 * Subscribe to events that imply `--safe-area-inset-*` or layout viewport may have changed.
 * MainActivity updates root `style` asynchronously relative to `orientationchange`; pairing
 * MutationObserver with deferred reads keeps React padding in sync with portrait insets.
 * 
 * IMPORTANT: Pauses monitoring when app is backgrounded to prevent watchdog termination
 * (0x8BADF00D) caused by layout feedback loops during WKWebView frame changes.
 */
export const subscribeToSafeAreaInsetChanges = (
  onInsetsMayHaveChanged: () => void
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {}
  }

  let rafDebounce = false
  let isPaused = false // Pause monitoring when app is backgrounded

  const scheduleRaf = () => {
    if (rafDebounce || isPaused) {
      return
    }

    rafDebounce = true
    requestAnimationFrame(() => {
      rafDebounce = false
      if (!isPaused) {
        onInsetsMayHaveChanged()
      }
    })
  }

  let observer: MutationObserver | null = null

  try {
    observer = new MutationObserver(() => {
      if (!isPaused) {
        scheduleRaf()
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    })
  } catch {
    // Non-Node documentElement in tests
  }

  const vv = window.visualViewport

  const onViewportChange = () => {
    if (!isPaused) {
      onInsetsMayHaveChanged()
    }
  }

  vv?.addEventListener("resize", onViewportChange)
  vv?.addEventListener("scroll", scheduleRaf)
  window.addEventListener("resize", onViewportChange)

  let timeout0: ReturnType<typeof setTimeout> | undefined
  let timeout1: ReturnType<typeof setTimeout> | undefined
  let timeout2: ReturnType<typeof setTimeout> | undefined

  const onOrientationLike = () => {
    if (isPaused) return
    
    scheduleRaf()
    onInsetsMayHaveChanged()

    if (timeout0) clearTimeout(timeout0)
    if (timeout1) clearTimeout(timeout1)
    if (timeout2) clearTimeout(timeout2)

    timeout0 = setTimeout(onInsetsMayHaveChanged, 0)
    timeout1 = setTimeout(onInsetsMayHaveChanged, 120)
    timeout2 = setTimeout(onInsetsMayHaveChanged, 300)
  }

  window.addEventListener("orientationchange", onOrientationLike)
  screen.orientation?.addEventListener(
    "change",
    onOrientationLike as EventListener
  )

  // Pause monitoring when app goes to background to prevent watchdog termination
  // This is critical for iOS where WKWebView frame changes during backgrounding
  // can cause layout feedback loops that hang the main thread
  const handleVisibilityChange = () => {
    isPaused = document.hidden
    if (isPaused) {
      // Clear any pending timeouts when backgrounding
      if (timeout0) clearTimeout(timeout0)
      if (timeout1) clearTimeout(timeout1)
      if (timeout2) clearTimeout(timeout2)
      timeout0 = undefined
      timeout1 = undefined
      timeout2 = undefined
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange)

  // Also listen for pagehide which fires more reliably on iOS
  const handlePageHide = () => {
    isPaused = true
    if (timeout0) clearTimeout(timeout0)
    if (timeout1) clearTimeout(timeout1)
    if (timeout2) clearTimeout(timeout2)
    timeout0 = undefined
    timeout1 = undefined
    timeout2 = undefined
  }

  window.addEventListener("pagehide", handlePageHide)

  return () => {
    observer?.disconnect()
    vv?.removeEventListener("resize", onViewportChange)
    vv?.removeEventListener("scroll", scheduleRaf)
    window.removeEventListener("resize", onViewportChange)
    window.removeEventListener("orientationchange", onOrientationLike)
    screen.orientation?.removeEventListener(
      "change",
      onOrientationLike as EventListener
    )
    document.removeEventListener("visibilitychange", handleVisibilityChange)
    window.removeEventListener("pagehide", handlePageHide)

    if (timeout0) clearTimeout(timeout0)
    if (timeout1) clearTimeout(timeout1)
    if (timeout2) clearTimeout(timeout2)
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

const ANDROID_3BUTTON_NAV_HEIGHT_PX = 48
const ANDROID_GESTURE_NAV_HEIGHT_PX = 16

/**
 * Android nav bar inset for content padding.
 * Uses fixed values for consistency:
 * - 3-button navigation: 48px (standard Android nav bar height)
 * - Gesture navigation: 16px (minimal gesture area)
 */
export const clampAndroidNavigationInsetPx = (
  safeAreaInsetBottom: number,
  is3ButtonNav: boolean = false
): number => {
  // Use fixed values based on nav type for consistency with native layer
  return is3ButtonNav ? ANDROID_3BUTTON_NAV_HEIGHT_PX : ANDROID_GESTURE_NAV_HEIGHT_PX
}

/**
 * Detect if Android is using 3-button navigation (vs gesture navigation).
 * MainActivity sets 'fintr-has-3btn-nav' class when navigation bar height >= 40px.
 * 3-button nav: typically 48px+, Gesture nav: typically 16-24px
 */
export const hasAndroid3ButtonNav = (): boolean => {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("fintr-has-3btn-nav")
}

/**
 * Get the appropriate Android navigation height based on nav type.
 * 3-button nav: uses actual inset (typically 48px+)
 * Gesture nav: uses actual inset or 16px minimum (typically 16-24px)
 */
export const getAndroidNavHeightPx = (): number => {
  const insets = getSafeAreaInsets()
  
  // The class is set based on height threshold in MainActivity
  // Just return the actual inset - the class determines padding behavior
  return insets.bottom
}

/**
 * Calculate bottom padding for mobile layouts
 * Accounts for 3-button navigation on Android and safe areas on iOS
 *
 * Android 3-button nav requires minimum 48px for the navigation bar
 * iOS uses the safe area inset for home indicator
 * Mobile browsers need standard bottom padding
 *
 * NOTE: We cap the navigation height (see MAX_ANDROID_NAV_INSET_PX) so glitches
 * do not exceed typical device bars; values above that look like the "huge padding" bug.
 */
export const calculateBottomPadding = (
  isAndroidNative: boolean,
  isIOSNative: boolean,
  safeAreaInsetBottom: number,
  has3ButtonNav?: boolean // Optional: if not provided, will check CSS class
): string => {
  const MIN_IOS_NAV_HEIGHT = 16
  const MAX_NAV_HEIGHT = 80

  if (isAndroidNative) {
    // Android: differentiate between 3-button and gesture navigation
    // Use parameter if provided, otherwise check CSS class for consistency
    const is3Button = has3ButtonNav !== undefined ? has3ButtonNav : hasAndroid3ButtonNav()
    const navHeight = is3Button ? 48 : Math.max(safeAreaInsetBottom, 16)
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
 * NOTE: Same clamp as {@link clampAndroidNavigationInsetPx} for nav offset.
 */
export const calculateNavBottomOffset = (
  isAndroidNative: boolean,
  isIOSNative: boolean,
  safeAreaInsetBottom: number
): string | number => {
  // Android: shift up by safe area amount (3-button nav or gesture nav)
  if (isAndroidNative) {
    // Differentiate between 3-button nav (48px) and gesture nav (16px or actual inset)
    const navHeight = hasAndroid3ButtonNav() ? 48 : Math.max(safeAreaInsetBottom, 16)
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
 * A ceiling avoids huge top gaps when insets spike after IME or rotation.
 * iOS is unchanged (uses env() in calculateHeaderSpacerHeight).
 */
export const MIN_ANDROID_STATUS_BAR_INSET_PX = 24

export const MAX_ANDROID_STATUS_BAR_INSET_PX = 48

export const resolveAndroidNativeTopInsetPx = (
  safeAreaInsetTop: number
): number => {
  const lifted = Math.max(
    safeAreaInsetTop,
    MIN_ANDROID_STATUS_BAR_INSET_PX
  )

  return Math.min(lifted, MAX_ANDROID_STATUS_BAR_INSET_PX)
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

  // Stable Android baseline: reserve status-bar breathing room without drift.
  if (isAndroidNative) {
    return `calc(${baseHeight}px + 24px)`
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
    hasAndroid3ButtonNav: typeof window !== "undefined" ? hasAndroid3ButtonNav() : false,
  }
}
