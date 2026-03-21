import { test, expect, Page } from "@playwright/test"

/**
 * E2E tests for dynamic behavior changes that affect safe area padding
 * This specifically tests the "padding becomes very huge" issue when behaviors change
 */

const userAgents = {
  androidNative:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp",
  iosNative:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp",
}

/**
 * Setup platform detection mock with dynamic safe area capability
 */
async function setupDynamicPlatform(
  page: Page,
  userAgent: string,
  initialInsets: { bottom: number; top: number } = { bottom: 48, top: 0 }
) {
  await page.addInitScript(
    ({ ua, insets }) => {
      // Override user agent
      Object.defineProperty(navigator, "userAgent", {
        get: () => ua,
        configurable: true,
      })

      // Create mutable safe area insets
      let currentInsets = { ...insets }

      // Expose a function to change insets dynamically (simulating system changes)
      ;(window as any).simulateSafeAreaChange = (newInsets: {
        bottom?: number
        top?: number
      }) => {
        currentInsets = { ...currentInsets, ...newInsets }

        // Update CSS variables
        const root = document.documentElement
        root.style.setProperty(
          "--safe-area-inset-bottom",
          `${currentInsets.bottom}px`
        )
        root.style.setProperty(
          "--safe-area-inset-top",
          `${currentInsets.top}px`
        )

        // Dispatch resize event to trigger recalculation
        window.dispatchEvent(new Event("resize"))
      }

      // Set initial CSS variables
      if (typeof document !== "undefined") {
        const style = document.createElement("style")
        style.textContent = `
          :root {
            --safe-area-inset-bottom: ${currentInsets.bottom}px;
            --safe-area-inset-top: ${currentInsets.top}px;
            --safe-area-inset-left: 0px;
            --safe-area-inset-right: 0px;
          }
        `
        document.head.appendChild(style)
      }
    },
    { ua: userAgent, insets: initialInsets }
  )
}

test.describe("Dynamic Safe Area Changes - Android", () => {
  test("padding does not explode when switching from gesture to 3-button nav", async ({
    page,
  }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 16, // Start with gesture nav
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    // Get initial padding
    const contentArea = page.locator('[style*="padding-bottom"]').first()
    const initialPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    // Simulate switching to 3-button navigation (48px)
    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 48 })
    })

    // Wait for recalculation
    await page.waitForTimeout(100)

    // Get new padding
    const newPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    // Padding should increase but not explode (should be reasonable)
    expect(newPadding).toBeGreaterThan(initialPadding)
    expect(newPadding).toBeLessThan(300) // Should never exceed 300px
    expect(newPadding).toBeGreaterThanOrEqual(110) // 64px nav + 48px min
  })

  test("padding handles rapid consecutive changes", async ({ page }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 48,
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const contentArea = page.locator('[style*="padding-bottom"]').first()

    // Simulate rapid changes
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        ;(window as any).simulateSafeAreaChange({ bottom: 16 })
      })
      await page.waitForTimeout(50)

      await page.evaluate(() => {
        ;(window as any).simulateSafeAreaChange({ bottom: 48 })
      })
      await page.waitForTimeout(50)
    }

    // Final padding should still be reasonable
    const finalPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    expect(finalPadding).toBeLessThan(300)
    expect(finalPadding).toBeGreaterThanOrEqual(110)
  })

  test("navigation position stays correct during safe area changes", async ({
    page,
  }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 48,
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const bottomNav = page.locator("nav.fixed").first()

    // Get initial position
    const initialBottom = await bottomNav.evaluate((el) =>
      window.getComputedStyle(el).bottom
    )

    // Change to gesture nav (smaller safe area)
    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 16 })
    })
    await page.waitForTimeout(100)

    // Get new position
    const newBottom = await bottomNav.evaluate((el) =>
      window.getComputedStyle(el).bottom
    )

    // Bottom position should be valid CSS value
    expect(newBottom).toMatch(/px$/)

    // Navigation should still be visible near bottom
    const box = await bottomNav.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.y).toBeGreaterThan(400) // Should be in lower half of viewport
    }
  })

  test("content remains accessible after multiple orientation + safe area changes", async ({
    page,
  }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 48,
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const contentArea = page.locator('[style*="padding-bottom"]').first()

    // Simulate orientation change + safe area change
    await page.setViewportSize({ width: 851, height: 393 }) // Landscape
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 16 })
    })

    await page.setViewportSize({ width: 393, height: 851 }) // Portrait
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 48 })
    })

    // Content should still be usable
    const padding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    expect(padding).toBeLessThan(300)
    expect(padding).toBeGreaterThanOrEqual(80)
  })
})

test.describe("Dynamic Safe Area Changes - iOS", () => {
  test("handles home indicator visibility changes", async ({ page }) => {
    await setupDynamicPlatform(page, userAgents.iosNative, {
      bottom: 34, // Home indicator visible
      top: 47,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const contentArea = page.locator('[style*="padding-bottom"]').first()

    // Initial padding
    const initialPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    // Simulate home indicator disappearing (e.g., during certain gestures)
    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 8 })
    })
    await page.waitForTimeout(100)

    const smallerPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    // Padding should decrease but still be reasonable
    expect(smallerPadding).toBeLessThanOrEqual(initialPadding + 20) // Allow small variance
    expect(smallerPadding).toBeGreaterThanOrEqual(80)

    // Home indicator returns
    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ bottom: 34 })
    })
    await page.waitForTimeout(100)

    const restoredPadding = await contentArea.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).paddingBottom)
    )

    // Should return to similar value as initial
    expect(restoredPadding).toBeGreaterThanOrEqual(initialPadding - 20)
    expect(restoredPadding).toBeLessThan(300)
  })

  test("maintains consistent header height during safe area changes", async ({
    page,
  }) => {
    await setupDynamicPlatform(page, userAgents.iosNative, {
      bottom: 34,
      top: 47,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const headerSpacer = page.locator('[class*="mobile-header-spacer"]').first()

    // Initial height
    const initialHeight = await headerSpacer.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).height)
    )

    // Change safe area
    await page.evaluate(() => {
      ;(window as any).simulateSafeAreaChange({ top: 59 }) // Larger notch
    })
    await page.waitForTimeout(100)

    const newHeight = await headerSpacer.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).height)
    )

    // Height should change appropriately but not explode
    expect(newHeight).toBeGreaterThan(initialHeight - 5) // Allow small variance
    expect(newHeight).toBeLessThan(200) // Should never be this huge
  })
})

test.describe("No Padding Explosion - Regression Tests", () => {
  test("Android padding never exceeds reasonable max", async ({ page }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 48,
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const contentArea = page.locator('[style*="padding-bottom"]').first()

    // Try various extreme values
    const extremeValues = [0, 16, 48, 60, 80, 100, 200]

    for (const value of extremeValues) {
      await page.evaluate((v) => {
        ;(window as any).simulateSafeAreaChange({ bottom: v })
      }, value)
      await page.waitForTimeout(50)

      const padding = await contentArea.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).paddingBottom)
      )

      // Padding should never exceed 300px (this would be the "huge" bug)
      expect(padding).toBeLessThan(
        300,
        `Padding exploded to ${padding}px with safe area ${value}px`
      )
    }
  })

  test("iOS padding never exceeds reasonable max", async ({ page }) => {
    await setupDynamicPlatform(page, userAgents.iosNative, {
      bottom: 34,
      top: 47,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const contentArea = page.locator('[style*="padding-bottom"]').first()

    // Try extreme values
    const extremeValues = [0, 16, 34, 60, 80, 100]

    for (const value of extremeValues) {
      await page.evaluate((v) => {
        ;(window as any).simulateSafeAreaChange({ bottom: v })
      }, value)
      await page.waitForTimeout(50)

      const padding = await contentArea.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).paddingBottom)
      )

      // iOS padding should never explode either
      expect(padding).toBeLessThan(
        300,
        `iOS padding exploded to ${padding}px with safe area ${value}px`
      )
    }
  })

  test("bottom navigation stays within viewport bounds", async ({ page }) => {
    await setupDynamicPlatform(page, userAgents.androidNative, {
      bottom: 48,
      top: 0,
    })

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const viewportHeight = 851
    await page.setViewportSize({ width: 393, height: viewportHeight })

    const bottomNav = page.locator("nav.fixed").first()

    // Rapidly change safe area values
    for (let i = 0; i < 10; i++) {
      const randomBottom = Math.floor(Math.random() * 100)
      await page.evaluate((v) => {
        ;(window as any).simulateSafeAreaChange({ bottom: v })
      }, randomBottom)
      await page.waitForTimeout(30)
    }

    // Navigation should still be within viewport
    const box = await bottomNav.boundingBox()
    expect(box).not.toBeNull()

    if (box) {
      // Bottom of nav should not exceed viewport height by much
      expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight + 50)
      // Top of nav should be within viewport
      expect(box.y).toBeGreaterThanOrEqual(0)
    }
  })
})
