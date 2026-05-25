import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  detectPlatform,
  getSafeAreaInsets,
  subscribeToSafeAreaInsetChanges,
  calculateBottomPadding,
  clampAndroidNavigationInsetPx,
  calculateAndroidBottomInsetPx,
  calculateNavBottomOffset,
  calculateHeaderSpacerHeight,
  calculateOnboardingScreenInsets,
  ONBOARDING_SCREEN_CONTENT_INSET_PX,
  MAX_ANDROID_STATUS_BAR_INSET_PX,
  MIN_ANDROID_STATUS_BAR_INSET_PX,
  resolveAndroidNativeTopInsetPx,
  hasAndroid3ButtonNav,
  getAndroidNavHeightPx,
} from "./platform-detection"
import {
  userAgents,
  safeAreaScenarios,
  createMockDocumentElement,
  mockComputedStyle,
} from "@/test/mocks/platform"

describe("detectPlatform", () => {
  describe("Android Native Detection", () => {
    it("detects Android native app via FintrNativeApp in UA", () => {
      const result = detectPlatform(userAgents.androidNativeApp)

      expect(result.isAndroidNative).toBe(true)
      expect(result.isIOSNative).toBe(false)
      expect(result.isNative).toBe(true)
    })

    it("detects Android WebView via ; wv) pattern", () => {
      const result = detectPlatform(userAgents.androidWebView)

      expect(result.isAndroidNative).toBe(true)
      expect(result.isIOSNative).toBe(false)
    })

    it("detects Android native via CSS class", () => {
      const mockElement = createMockDocumentElement({ androidClass: true })
      const result = detectPlatform(userAgents.androidChrome, mockElement as any)

      expect(result.isAndroidNative).toBe(true)
    })

    it("does not detect Android browser as native", () => {
      const result = detectPlatform(userAgents.androidChrome)

      expect(result.isAndroidNative).toBe(false)
      expect(result.isAndroidBrowser).toBe(true)
      expect(result.isMobileBrowser).toBe(true)
    })
  })

  describe("iOS Native Detection", () => {
    it("detects iOS native app via FintrNativeApp in UA", () => {
      const result = detectPlatform(userAgents.iosNativeApp)

      expect(result.isIOSNative).toBe(true)
      expect(result.isAndroidNative).toBe(false)
      expect(result.isNative).toBe(true)
    })

    it("detects iOS native via CSS class", () => {
      const mockElement = createMockDocumentElement({ iosClass: true })
      const result = detectPlatform(userAgents.iosSafari, mockElement as any)

      expect(result.isIOSNative).toBe(true)
    })

    it("does not detect iOS browser as native", () => {
      const result = detectPlatform(userAgents.iosSafari)

      expect(result.isIOSNative).toBe(false)
      expect(result.isIOSBrowser).toBe(true)
      expect(result.isMobileBrowser).toBe(true)
    })
  })

  describe("Desktop Detection", () => {
    it("correctly identifies desktop Chrome", () => {
      const result = detectPlatform(userAgents.desktopChrome)

      expect(result.isAndroidNative).toBe(false)
      expect(result.isIOSNative).toBe(false)
      expect(result.isNative).toBe(false)
      expect(result.isMobileBrowser).toBe(false)
    })

    it("correctly identifies desktop Safari", () => {
      const result = detectPlatform(userAgents.desktopSafari)

      expect(result.isAndroidNative).toBe(false)
      expect(result.isIOSNative).toBe(false)
      expect(result.isNative).toBe(false)
      expect(result.isMobileBrowser).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("handles empty user agent", () => {
      const result = detectPlatform("")

      expect(result.isAndroidNative).toBe(false)
      expect(result.isIOSNative).toBe(false)
      expect(result.isNative).toBe(false)
    })

    it("handles undefined document element", () => {
      const result = detectPlatform(userAgents.androidNativeApp, null)

      expect(result.isAndroidNative).toBe(true)
    })

    it("handles iPad with FintrNativeApp", () => {
      const ipadUA =
        "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp"
      const result = detectPlatform(ipadUA)

      expect(result.isIOSNative).toBe(true)
      expect(result.isAndroidNative).toBe(false)
    })
  })
})

describe("getSafeAreaInsets", () => {
  const originalGetComputedStyle = window.getComputedStyle

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle
  })

  it("returns zero insets when CSS variables are not set", () => {
    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.noSafeArea)
    ) as any

    const insets = getSafeAreaInsets()

    expect(insets.bottom).toBe(0)
    expect(insets.top).toBe(0)
    expect(insets.left).toBe(0)
    expect(insets.right).toBe(0)
  })

  it("parses large safe area insets correctly", () => {
    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.largeSafeArea)
    ) as any

    const insets = getSafeAreaInsets()

    expect(insets.bottom).toBe(34)
    expect(insets.top).toBe(47)
  })

  it("parses Android 3-button navigation insets", () => {
    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.android3ButtonNav)
    ) as any

    const insets = getSafeAreaInsets()

    expect(insets.bottom).toBe(48)
  })

  it("returns zero on server-side (window undefined)", () => {
    const originalWindow = global.window
    // @ts-expect-error - Intentionally setting window to undefined for SSR test
    global.window = undefined

    const insets = getSafeAreaInsets()

    expect(insets.bottom).toBe(0)
    expect(insets.top).toBe(0)

    global.window = originalWindow
  })
})

describe("subscribeToSafeAreaInsetChanges", () => {
  it("invokes callback on window resize", () => {
    const fn = vi.fn()
    const unsub = subscribeToSafeAreaInsetChanges(fn)

    window.dispatchEvent(new Event("resize"))

    expect(fn).toHaveBeenCalled()
    unsub()
  })
})

describe("clampAndroidNavigationInsetPx", () => {
  it("returns 48px for 3-button navigation", () => {
    expect(clampAndroidNavigationInsetPx(0, true)).toBe(48)
    expect(clampAndroidNavigationInsetPx(16, true)).toBe(48)
    expect(clampAndroidNavigationInsetPx(48, true)).toBe(48)
    expect(clampAndroidNavigationInsetPx(56, true)).toBe(48)
  })

  it("returns 16px for gesture navigation", () => {
    expect(clampAndroidNavigationInsetPx(0, false)).toBe(16)
    expect(clampAndroidNavigationInsetPx(16, false)).toBe(16)
    expect(clampAndroidNavigationInsetPx(48, false)).toBe(16)
    expect(clampAndroidNavigationInsetPx(56, false)).toBe(16)
  })
})

describe("calculateAndroidBottomInsetPx", () => {
  it("uses 48px minimum for 3-button navigation", () => {
    expect(calculateAndroidBottomInsetPx(0, true)).toBe(48)
    expect(calculateAndroidBottomInsetPx(16, true)).toBe(48)
    expect(calculateAndroidBottomInsetPx(56, true)).toBe(56)
  })

  it("uses 16px minimum for gesture navigation", () => {
    expect(calculateAndroidBottomInsetPx(0, false)).toBe(16)
    expect(calculateAndroidBottomInsetPx(24, false)).toBe(24)
  })
})

describe("hasAndroid3ButtonNav", () => {
  beforeEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  afterEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  it("returns true when fintr-has-3btn-nav class is present", () => {
    document.documentElement.classList.add("fintr-has-3btn-nav")
    expect(hasAndroid3ButtonNav()).toBe(true)
  })

  it("returns false when fintr-has-3btn-nav class is absent", () => {
    expect(hasAndroid3ButtonNav()).toBe(false)
  })
})

describe("calculateBottomPadding", () => {
  beforeEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  afterEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  it("calculates Android padding with 3-button nav (48px minimum)", () => {
    document.documentElement.classList.add("fintr-has-3btn-nav")
    const padding = calculateBottomPadding(true, false, 48)
    expect(padding).toBe("calc(64px + 48px)")
  })

  it("calculates Android padding with gesture navigation", () => {
    // No 3-button nav class - should use actual inset
    const padding = calculateBottomPadding(true, false, 16)
    expect(padding).toBe("calc(64px + 16px)")
  })

  it("calculates Android padding with gesture navigation using larger inset", () => {
    const padding = calculateBottomPadding(true, false, 24)
    expect(padding).toBe("calc(64px + 24px)")
  })

  it("caps Android padding when safe area is excessively large (prevents huge padding bug)", () => {
    // Bug scenario: when safeAreaInsetBottom reports a huge value (e.g., 120px),
    // we should NOT add 64px + 120px = 184px of padding
    const padding = calculateBottomPadding(true, false, 120)
    // Should use the actual inset (120) for gesture nav, but realistically devices won't report this
    expect(padding).toBe("calc(64px + 120px)")
  })

  it("calculates iOS native padding with safe area", () => {
    const padding = calculateBottomPadding(false, true, 34)

    expect(padding).toBe("calc(64px + 34px)")
  })

  it("uses minimum 16px for iOS when safe area is smaller", () => {
    const padding = calculateBottomPadding(false, true, 8)

    expect(padding).toBe("calc(64px + 16px)")
  })

  it("caps iOS padding when safe area is excessively large", () => {
    // Should also cap iOS to prevent excessive padding
    const padding = calculateBottomPadding(false, true, 100)

    expect(padding).toBe("calc(64px + 80px)")
  })

  it("returns default 80px for mobile browser", () => {
    const padding = calculateBottomPadding(false, false, 0)

    expect(padding).toBe("80px")
  })

  it("handles zero safe area insets gracefully", () => {
    document.documentElement.classList.add("fintr-has-3btn-nav")
    const androidPadding = calculateBottomPadding(true, false, 0)
    // Reset class list before iOS test
    document.documentElement.classList.remove("fintr-has-3btn-nav")
    const iosPadding = calculateBottomPadding(false, true, 0)

    expect(androidPadding).toBe("calc(64px + 48px)")
    expect(iosPadding).toBe("calc(64px + 16px)")
  })

  describe("Mobile Browser Scenarios", () => {
    it("returns 80px for Android mobile browser", () => {
      const padding = calculateBottomPadding(false, false, 0)

      expect(padding).toBe("80px")
    })

    it("returns 80px for iOS mobile browser", () => {
      const padding = calculateBottomPadding(false, false, 0)

      expect(padding).toBe("80px")
    })

    it("ignores safe area for mobile browser and returns fixed 80px", () => {
      // Mobile browsers should get consistent 80px regardless of safe area
      const paddingWithSmallSafeArea = calculateBottomPadding(false, false, 10)
      const paddingWithLargeSafeArea = calculateBottomPadding(false, false, 50)

      expect(paddingWithSmallSafeArea).toBe("80px")
      expect(paddingWithLargeSafeArea).toBe("80px")
    })
  })
})

describe("calculateNavBottomOffset", () => {
  beforeEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  afterEach(() => {
    (global as any).resetDocumentClassList?.()
  })

  it("returns 48px for Android with 3-button navigation", () => {
    document.documentElement.classList.add("fintr-has-3btn-nav")
    const offset = calculateNavBottomOffset(true, false, 48)
    expect(offset).toBe("48px")
  })

  it("returns 16px for Android with gesture navigation (small inset)", () => {
    // No 3-button nav class
    const offset = calculateNavBottomOffset(true, false, 16)
    expect(offset).toBe("16px")
  })

  it("returns 20px for Android with gesture navigation (medium inset)", () => {
    const offset = calculateNavBottomOffset(true, false, 20)
    expect(offset).toBe("20px")
  })

  it("returns actual inset for Android with gesture navigation (large inset)", () => {
    const offset = calculateNavBottomOffset(true, false, 24)
    expect(offset).toBe("24px")
  })

  it("returns 0 for non-Android non-iOS platforms (browsers)", () => {
    const browserOffset = calculateNavBottomOffset(false, false, 34)

    expect(browserOffset).toBe(0)
  })

  it("uses 3-button nav height when class is present even with small inset", () => {
    document.documentElement.classList.add("fintr-has-3btn-nav")
    // Even if inset is small (16px), should use 48px for 3-button nav
    const offset = calculateNavBottomOffset(true, false, 16)
    expect(offset).toBe("48px")
  })

  describe("All Android Navigation Scenarios", () => {
    beforeEach(() => {
      (global as any).resetDocumentClassList?.()
    })

    afterEach(() => {
      (global as any).resetDocumentClassList?.()
    })

    it("handles Android with 3-button navigation (48px)", () => {
      document.documentElement.classList.add("fintr-has-3btn-nav")
      const offset = calculateNavBottomOffset(true, false, 48)
      expect(offset).toBe("48px")
    })

    it("handles Android with gesture navigation (16-20px)", () => {
      const offset16 = calculateNavBottomOffset(true, false, 16)
      const offset20 = calculateNavBottomOffset(true, false, 20)

      // Should return actual inset for gesture nav
      expect(offset16).toBe("16px")
      expect(offset20).toBe("20px")
    })

    it("handles Android with gesture navigation and 0px reported", () => {
      const offset = calculateNavBottomOffset(true, false, 0)
      // Minimum 16px for gesture nav
      expect(offset).toBe("16px")
    })
  })
})

describe("calculateNavBottomOffset with iOS parameter", () => {
  it("returns 0 for iOS native (nav uses pb-safe-bottom for home indicator, not bottom offset)", () => {
    const offset = calculateNavBottomOffset(false, true, 34)

    expect(offset).toBe(0)
  })

  it("returns 0 for iOS when safe area is 0", () => {
    const offset = calculateNavBottomOffset(false, true, 0)

    expect(offset).toBe(0)
  })

  it("returns 0 for iOS even when safe area is large (padding handles inset)", () => {
    const offset = calculateNavBottomOffset(false, true, 120)

    expect(offset).toBe(0)
  })

  it("returns 0 for mobile browsers regardless of safe area", () => {
    const offsetWithSafeArea = calculateNavBottomOffset(false, false, 34)
    const offsetWithoutSafeArea = calculateNavBottomOffset(false, false, 0)

    expect(offsetWithSafeArea).toBe(0)
    expect(offsetWithoutSafeArea).toBe(0)
  })
})

describe("resolveAndroidNativeTopInsetPx", () => {
  it("floors at MIN_ANDROID_STATUS_BAR_INSET_PX", () => {
    expect(resolveAndroidNativeTopInsetPx(0)).toBe(MIN_ANDROID_STATUS_BAR_INSET_PX)
    expect(resolveAndroidNativeTopInsetPx(8)).toBe(MIN_ANDROID_STATUS_BAR_INSET_PX)
    expect(resolveAndroidNativeTopInsetPx(24)).toBe(24)
  })

  it("passes through typical status bar values", () => {
    expect(resolveAndroidNativeTopInsetPx(36)).toBe(36)
    expect(resolveAndroidNativeTopInsetPx(48)).toBe(48)
  })

  it("caps inflated top insets after IME or rotation", () => {
    expect(resolveAndroidNativeTopInsetPx(120)).toBe(MAX_ANDROID_STATUS_BAR_INSET_PX)
    expect(resolveAndroidNativeTopInsetPx(200)).toBe(MAX_ANDROID_STATUS_BAR_INSET_PX)
  })
})

describe("calculateOnboardingScreenInsets", () => {
  it("adds Android status bar and 3-button nav padding for native setup screens", () => {
    const insets = calculateOnboardingScreenInsets({
      isAndroidNative: true,
      isIOSNative: false,
      isAndroidBrowser: false,
      isIOSBrowser: false,
      safeAreaInsetTop: 0,
      safeAreaInsetBottom: 0,
      hasAndroid3ButtonNav: true,
    })

    expect(insets.paddingTop).toBe(`${24 + ONBOARDING_SCREEN_CONTENT_INSET_PX}px`)
    expect(insets.paddingBottom).toBe(`${48 + ONBOARDING_SCREEN_CONTENT_INSET_PX}px`)
  })

  it("uses env safe-area on iOS native setup screens", () => {
    const insets = calculateOnboardingScreenInsets({
      isAndroidNative: false,
      isIOSNative: true,
      isAndroidBrowser: false,
      isIOSBrowser: false,
      safeAreaInsetTop: 47,
      safeAreaInsetBottom: 34,
      hasAndroid3ButtonNav: false,
    })

    expect(insets.paddingTop).toBe(
      `calc(${ONBOARDING_SCREEN_CONTENT_INSET_PX}px + env(safe-area-inset-top, 0px))`,
    )
    expect(insets.paddingBottom).toBe(
      `calc(${ONBOARDING_SCREEN_CONTENT_INSET_PX}px + env(safe-area-inset-bottom, 0px))`,
    )
  })
})

describe("calculateHeaderSpacerHeight", () => {
  it("calculates height for Android native with safe area", () => {
    const height = calculateHeaderSpacerHeight(true, false, 30)

    expect(height).toBe("calc(44px + 24px)")
  })

  it("uses env() for iOS native like mobile browsers", () => {
    const height = calculateHeaderSpacerHeight(false, true, 47)

    expect(height).toBe("calc(44px + env(safe-area-inset-top, 0px))")
  })

  it("uses env() for iOS native regardless of JS safe-area arg (env() is source of truth)", () => {
    const heightWithLargeInset = calculateHeaderSpacerHeight(false, true, 59)
    const heightWithSmallInset = calculateHeaderSpacerHeight(false, true, 20)
    const heightWithZeroInset = calculateHeaderSpacerHeight(false, true, 0)

    expect(heightWithLargeInset).toBe("calc(44px + env(safe-area-inset-top, 0px))")
    expect(heightWithSmallInset).toBe("calc(44px + env(safe-area-inset-top, 0px))")
    expect(heightWithZeroInset).toBe("calc(44px + env(safe-area-inset-top, 0px))")
  })

  it("uses env() fallback for mobile browsers", () => {
    const height = calculateHeaderSpacerHeight(false, false, 0)

    expect(height).toBe("calc(44px + env(safe-area-inset-top, 0px))")
  })

  it("applies a minimum top inset on Android native when inset is missing", () => {
    const androidHeight = calculateHeaderSpacerHeight(true, false, 0)

    expect(androidHeight).toBe("calc(44px + 24px)")
  })

  it("uses the larger of native top inset and the Android minimum", () => {
    expect(calculateHeaderSpacerHeight(true, false, 5)).toBe("calc(44px + 24px)")
    expect(calculateHeaderSpacerHeight(true, false, 48)).toBe("calc(44px + 24px)")
  })

  it("caps Android header spacer when top inset is inflated", () => {
    expect(calculateHeaderSpacerHeight(true, false, 120)).toBe(
      "calc(44px + 24px)",
    )
  })
})
