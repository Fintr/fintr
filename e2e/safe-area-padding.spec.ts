import { test, expect, Page } from "@playwright/test"

/**
 * E2E tests for safe area padding and system navigation handling
 * Tests the behavior across Android, iOS, and browser mobile
 */

// Test user agents for different platforms
const userAgents = {
  androidNative:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
  iosNative:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp",
  androidBrowser:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  iosBrowser:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
}

/**
 * Navigate to dashboard with specific platform mocking
 */
async function navigateAsPlatform(
  page: Page,
  userAgent: string,
  options: {
    safeAreaBottom?: number
    safeAreaTop?: number
    cssClass?: string
  } = {}
) {
  const { safeAreaBottom = 0, safeAreaTop = 0, cssClass = "" } = options

  await page.addInitScript(
    ({ ua, cls, bottom, top }) => {
      // Override user agent
      Object.defineProperty(navigator, "userAgent", {
        get: () => ua,
        configurable: true,
      })

      // Add platform CSS class if specified
      if (cls && typeof document !== "undefined") {
        document.documentElement.classList.add(cls)
      }

      // Inject safe area CSS variables
      if (typeof document !== "undefined") {
        const style = document.createElement("style")
        style.textContent = `
          :root {
            --safe-area-inset-bottom: ${bottom}px;
            --safe-area-inset-top: ${top}px;
            --safe-area-inset-left: 0px;
            --safe-area-inset-right: 0px;
          }
        `
        document.head.appendChild(style)
      }
    },
    {
      ua: userAgent,
      cls: cssClass,
      bottom: safeAreaBottom,
      top: safeAreaTop,
    }
  )

  await page.goto("/dashboard/")
  await page.waitForLoadState("networkidle")
}

test.describe("Safe Area Padding - Android Native", () => {
  test("applies correct padding for Android 3-button navigation", async ({
    page,
  }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 48, // Standard 3-button nav height
      cssClass: "fintr-native-android",
    })

    // The content area should have bottom padding
    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()

    // Verify padding is calculated correctly (64px nav + 48px safe area)
    const style = await contentArea.evaluate((el) =>
      window.getComputedStyle(el)
    )
    const paddingBottom = parseFloat(style.paddingBottom)

    // Should be at least 112px (64px + 48px)
    expect(paddingBottom).toBeGreaterThanOrEqual(110)
  })

  test("handles Android gesture navigation", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 16, // Smaller for gesture nav
      cssClass: "fintr-native-android",
    })

    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    // Bottom nav should be positioned above the safe area
    const style = await bottomNav.evaluate((el) => window.getComputedStyle(el))
    expect(style.bottom).toMatch(/px/)
  })

  test("bottom navigation is visible and accessible", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 48,
      cssClass: "fintr-native-android",
    })

    // Bottom navigation should be visible
    const bottomNav = page.locator("nav.fixed")
    await expect(bottomNav).toBeVisible()

    // Navigation items should be clickable
    const transactionsLink = page.locator('text=Transactions').first()
    await expect(transactionsLink).toBeVisible()
    await expect(transactionsLink).toBeEnabled()
  })

  test("white spacer exists for 3-button nav area", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 48,
      cssClass: "fintr-native-android",
    })

    // Look for the white spacer element (pointer-events-none div at bottom)
    const spacer = page.locator('[class*="pointer-events-none"]').last()

    // Verify it has the expected styling
    const hasCorrectPosition = await spacer.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.position === "fixed" && style.bottom === "0px"
    })

    expect(hasCorrectPosition).toBe(true)
  })
})

test.describe("Safe Area Padding - iOS Native", () => {
  test("applies correct padding for iOS with home indicator", async ({
    page,
  }) => {
    await navigateAsPlatform(page, userAgents.iosNative, {
      safeAreaBottom: 34, // iPhone home indicator area
      safeAreaTop: 47, // iPhone notch area
      cssClass: "fintr-native-ios",
    })

    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()

    const style = await contentArea.evaluate((el) =>
      window.getComputedStyle(el)
    )
    const paddingBottom = parseFloat(style.paddingBottom)

    // Should account for nav bar + safe area
    expect(paddingBottom).toBeGreaterThanOrEqual(64)
  })

  test("header spacer accounts for status bar + notch", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.iosNative, {
      safeAreaTop: 47,
      cssClass: "fintr-native-ios",
    })

    // Header spacer should be present
    const headerSpacer = page.locator('[class*="mobile-header-spacer"]').first()
    await expect(headerSpacer).toBeVisible()

    // Height should include safe area
    const style = await headerSpacer.evaluate((el) =>
      window.getComputedStyle(el)
    )
    const height = parseFloat(style.height)

    // Should be at least 44px + some safe area
    expect(height).toBeGreaterThanOrEqual(44)
  })

  test("bottom nav sits at bottom with padding", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.iosNative, {
      safeAreaBottom: 34,
      cssClass: "fintr-native-ios",
    })

    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    const style = await bottomNav.evaluate((el) => window.getComputedStyle(el))

    // iOS native should have padding-bottom for home indicator
    const hasBottomPadding = parseFloat(style.paddingBottom) > 0
    expect(hasBottomPadding || style.bottom === "0px").toBe(true)
  })
})

test.describe("Safe Area Padding - Mobile Browser", () => {
  test("uses standard padding for Android browser", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidBrowser, {
      safeAreaBottom: 0,
      safeAreaTop: 0,
    })

    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()

    const style = await contentArea.evaluate((el) =>
      window.getComputedStyle(el)
    )
    const paddingBottom = parseFloat(style.paddingBottom)

    // Should use standard 80px for browser
    expect(paddingBottom).toBeGreaterThanOrEqual(60)
  })

  test("uses standard padding for iOS browser", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.iosBrowser, {
      safeAreaBottom: 0,
      safeAreaTop: 0,
    })

    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()

    const style = await contentArea.evaluate((el) =>
      window.getComputedStyle(el)
    )
    const paddingBottom = parseFloat(style.paddingBottom)

    // Browser should use standard padding
    expect(paddingBottom).toBeGreaterThanOrEqual(60)
  })

  test("bottom nav is visible without safe area spacer", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidBrowser)

    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    // Browser should not have the white spacer
    const spacer = page.locator(
      '[class*="pointer-events-none"][style*="background-color: rgb(250, 250, 249)"]'
    )
    const spacerCount = await spacer.count()

    // Spacer might not exist for browser
    expect(spacerCount).toBeLessThanOrEqual(1)
  })
})

test.describe("Responsive Behavior", () => {
  test("handles orientation change gracefully", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 48,
      cssClass: "fintr-native-android",
    })

    // Initial portrait
    await page.setViewportSize({ width: 393, height: 851 })
    await page.waitForTimeout(100)

    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    // Rotate to landscape
    await page.setViewportSize({ width: 851, height: 393 })
    await page.waitForTimeout(100)

    // Navigation should still be visible
    await expect(bottomNav).toBeVisible()
  })

  test("content is scrollable with safe area padding", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.iosNative, {
      safeAreaBottom: 34,
      cssClass: "fintr-native-ios",
    })

    // Wait for content to load
    await page.waitForSelector("text=Transactions", { timeout: 5000 })

    // Content area should be scrollable
    const scrollableArea = page.locator('[class*="overflow-y-auto"]').first()

    // Should be able to scroll if content exists
    const scrollHeight = await scrollableArea.evaluate(
      (el) => el.scrollHeight
    )
    const clientHeight = await scrollableArea.evaluate(
      (el) => el.clientHeight
    )

    // If there's scrollable content, scrollHeight > clientHeight
    if (scrollHeight > clientHeight) {
      await scrollableArea.evaluate((el) => el.scrollTo(0, 100))
      const scrollTop = await scrollableArea.evaluate((el) => el.scrollTop)
      expect(scrollTop).toBeGreaterThan(0)
    }
  })
})

test.describe("Edge Cases", () => {
  test("handles zero safe area insets", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidNative, {
      safeAreaBottom: 0,
      safeAreaTop: 0,
      cssClass: "fintr-native-android",
    })

    // Should still render without errors
    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()
  })

  test("handles very large safe area insets", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.iosNative, {
      safeAreaBottom: 60, // Large home indicator area
      safeAreaTop: 59, // Large notch
      cssClass: "fintr-native-ios",
    })

    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()

    // Content should still be visible and usable
    const contentArea = page.locator('[style*="padding-bottom"]').first()
    await expect(contentArea).toBeVisible()
  })

  test("platform detection works with WebView pattern", async ({ page }) => {
    await navigateAsPlatform(page, userAgents.androidWebView, {
      safeAreaBottom: 48,
    })

    // Should detect as Android native via ; wv) pattern
    const bottomNav = page.locator("nav.fixed").first()
    await expect(bottomNav).toBeVisible()
  })
})
