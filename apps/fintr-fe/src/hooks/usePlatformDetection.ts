"use client"

import { useState, useEffect } from "react"
import {
  detectPlatform,
  detectPlatformWithInsets,
  getSafeAreaInsets,
  hasAndroid3ButtonNav,
  PlatformDetectionResult,
  subscribeToSafeAreaInsetChanges,
} from "@/lib/platform-detection"

/**
 * Hook for platform detection with safe area insets
 * Returns platform info and re-calculates on resize/orientation change
 */
export const usePlatformDetection = (): PlatformDetectionResult => {
  const [platform, setPlatform] = useState<PlatformDetectionResult>(() => {
    if (typeof window === "undefined") {
      return {
        isAndroidNative: false,
        isIOSNative: false,
        isNative: false,
        isMobileBrowser: false,
        isAndroidBrowser: false,
        isIOSBrowser: false,
        safeAreaInsetBottom: 0,
        safeAreaInsetTop: 0,
        hasAndroid3ButtonNav: false,
      }
    }

    const baseDetection = detectPlatform(
      navigator.userAgent,
      document.documentElement
    )
    const insets = getSafeAreaInsets()

    return {
      ...baseDetection,
      safeAreaInsetBottom: insets.bottom,
      safeAreaInsetTop: insets.top,
      hasAndroid3ButtonNav: hasAndroid3ButtonNav(),
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const updatePlatform = () => {
      const baseDetection = detectPlatform(
        navigator.userAgent,
        document.documentElement
      )
      const insets = getSafeAreaInsets()
      const next: PlatformDetectionResult = {
        ...baseDetection,
        safeAreaInsetBottom: insets.bottom,
        safeAreaInsetTop: insets.top,
        hasAndroid3ButtonNav: hasAndroid3ButtonNav(),
      }

      // Only update state when values actually change to avoid spurious re-renders
      // (visualViewport scroll fires very frequently on iOS, e.g. inside modals)
      setPlatform((prev) => {
        if (
          prev.isAndroidNative === next.isAndroidNative &&
          prev.isIOSNative === next.isIOSNative &&
          prev.isNative === next.isNative &&
          prev.isMobileBrowser === next.isMobileBrowser &&
          prev.isAndroidBrowser === next.isAndroidBrowser &&
          prev.isIOSBrowser === next.isIOSBrowser &&
          prev.safeAreaInsetBottom === next.safeAreaInsetBottom &&
          prev.safeAreaInsetTop === next.safeAreaInsetTop &&
          prev.hasAndroid3ButtonNav === next.hasAndroid3ButtonNav
        ) {
          return prev
        }
        return next
      })
    }

    updatePlatform()

    return subscribeToSafeAreaInsetChanges(updatePlatform)
  }, [])

  return platform
}

/**
 * Hook specifically for safe area insets
 * Updates on window resize or orientation change
 */
export const useSafeAreaInsets = () => {
  const [insets, setInsets] = useState(() => {
    if (typeof window === "undefined") {
      return { bottom: 0, top: 0, left: 0, right: 0 }
    }
    return getSafeAreaInsets()
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateInsets = () => {
      setInsets(getSafeAreaInsets())
    }

    updateInsets()

    return subscribeToSafeAreaInsetChanges(updateInsets)
  }, [])

  return insets
}

/**
 * Debug helper to check Android 3-button nav detection.
 * Returns current state including class presence and document classes.
 * Use this in browser console: `window.checkAndroidNavDebug()`
 */
export const getAndroidNavDebugInfo = () => {
  if (typeof document === "undefined") {
    return { error: "Not in browser" }
  }

  const html = document.documentElement
  const allClasses = Array.from(html.classList)

  return {
    has3ButtonNavClass: hasAndroid3ButtonNav(),
    allDocumentClasses: allClasses,
    safeAreaInsets: getSafeAreaInsets(),
    userAgent: navigator.userAgent,
    isAndroidNative: detectPlatform(navigator.userAgent, html).isAndroidNative,
    platformDetection: detectPlatformWithInsets(),
  }
}

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as any).checkAndroidNavDebug = getAndroidNavDebugInfo
}
