import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePlatformDetection, useSafeAreaInsets } from "./usePlatformDetection"
import { mockComputedStyle, safeAreaScenarios } from "@/test/mocks/platform"

describe("usePlatformDetection", () => {
  const originalUserAgent = navigator.userAgent
  const originalGetComputedStyle = window.getComputedStyle

  beforeEach(() => {
    // Reset to real timers for all tests
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    })
    window.getComputedStyle = originalGetComputedStyle
  })

  it("returns initial SSR-safe values on first render", () => {
    const { result } = renderHook(() => usePlatformDetection())

    expect(result.current.isAndroidNative).toBe(false)
    expect(result.current.isIOSNative).toBe(false)
    expect(result.current.safeAreaInsetBottom).toBe(0)
    expect(result.current.safeAreaInsetTop).toBe(0)
  })

  it("detects Android native when FintrNativeApp in UA", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp",
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => usePlatformDetection())

    // Wait for useEffect to run by triggering a re-render
    await act(async () => {
      // Trigger a resize event to force the effect to update
      window.dispatchEvent(new Event("resize"))
      // Allow microtasks to complete
      await Promise.resolve()
    })

    expect(result.current.isAndroidNative).toBe(true)
    expect(result.current.isIOSNative).toBe(false)
  })

  it("detects iOS native when FintrNativeApp in UA", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp",
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => usePlatformDetection())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.isIOSNative).toBe(true)
    expect(result.current.isAndroidNative).toBe(false)
  })

  it("reads safe area insets from CSS variables", async () => {
    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.largeSafeArea)
    ) as any

    const { result } = renderHook(() => usePlatformDetection())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.safeAreaInsetBottom).toBe(34)
    expect(result.current.safeAreaInsetTop).toBe(47)
  })

  it("detects Android 3-button navigation scenario", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      writable: true,
      configurable: true,
    })

    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.android3ButtonNav)
    ) as any

    const { result } = renderHook(() => usePlatformDetection())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.isAndroidNative).toBe(true)
    expect(result.current.safeAreaInsetBottom).toBe(48)
  })

  it("detects mobile browser as non-native", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => usePlatformDetection())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.isAndroidNative).toBe(false)
    expect(result.current.isMobileBrowser).toBe(true)
    expect(result.current.isNative).toBe(false)
  })
})

describe("useSafeAreaInsets", () => {
  const originalGetComputedStyle = window.getComputedStyle

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle
  })

  it("returns SSR-safe values initially", () => {
    const { result } = renderHook(() => useSafeAreaInsets())

    expect(result.current.bottom).toBe(0)
    expect(result.current.top).toBe(0)
  })

  it("reads CSS environment variables", async () => {
    window.getComputedStyle = vi.fn(() =>
      mockComputedStyle(safeAreaScenarios.largeSafeArea)
    ) as any

    const { result } = renderHook(() => useSafeAreaInsets())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.bottom).toBe(34)
    expect(result.current.top).toBe(47)
  })

  it("handles missing CSS variables gracefully", async () => {
    window.getComputedStyle = vi.fn(() => ({
      getPropertyValue: () => "",
    })) as any

    const { result } = renderHook(() => useSafeAreaInsets())

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.bottom).toBe(0)
    expect(result.current.top).toBe(0)
  })
})
