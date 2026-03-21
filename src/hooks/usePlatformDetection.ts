"use client"

import { useState, useEffect } from "react"
import {
  detectPlatform,
  getSafeAreaInsets,
  PlatformDetectionResult,
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

      setPlatform({
        ...baseDetection,
        safeAreaInsetBottom: insets.bottom,
        safeAreaInsetTop: insets.top,
      })
    }

    updatePlatform()

    window.addEventListener("resize", updatePlatform)
    window.addEventListener("orientationchange", updatePlatform)

    return () => {
      window.removeEventListener("resize", updatePlatform)
      window.removeEventListener("orientationchange", updatePlatform)
    }
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

    window.addEventListener("resize", updateInsets)
    window.addEventListener("orientationchange", updateInsets)

    return () => {
      window.removeEventListener("resize", updateInsets)
      window.removeEventListener("orientationchange", updateInsets)
    }
  }, [])

  return insets
}
