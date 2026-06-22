import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

/**
 * E2E tests for CalendarPopover overlay close behavior.
 * Tests that tapping outside the calendar (on blurred area) closes the date picker.
 */

test.describe("CalendarPopover overlay dismiss", () => {
  test("closes when tapping overlay outside calendar", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const datePickButton = page.locator("button:has-text('Pick a date')").first()
    if (await datePickButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await datePickButton.click()
      await page.waitForTimeout(500)

      const sheet = page.locator('[data-state="open"]').first()
      const sheetVisible = await sheet.isVisible().catch(() => false)

      if (sheetVisible) {
        const calendar = page.locator(".rdp")
        if (await calendar.isVisible().catch(() => false)) {
          const calendarBox = await calendar.boundingBox()
          if (calendarBox) {
            const outsideX = 50
            const outsideY = 10
            await page.mouse.click(outsideX, outsideY)
            await page.waitForTimeout(500)

            const sheetStillOpen = await page.locator('[data-state="open"]').isVisible().catch(() => false)
            if (sheetStillOpen) {
              const openSheets = await page.locator('[data-state="open"]').count()
              console.log(`Sheet still open. Open sheets: ${openSheets}`)
            }
            expect(await page.locator('[data-state="open"]').count()).toBe(0)
          }
        }
      }
    }
  })

  test("calendar stays open when tapping inside calendar", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const datePickButton = page.locator("button:has-text('Pick a date')").first()
    if (await datePickButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await datePickButton.click()
      await page.waitForTimeout(500)

      const calendar = page.locator(".rdp")
      if (await calendar.isVisible().catch(() => false)) {
        const dayButton = page.locator(".rdp-button").nth(5)
        await dayButton.click()
        await page.waitForTimeout(300)

        const sheetStillOpen = await page.locator('[data-state="open"]').isVisible().catch(() => false)
        expect(sheetStillOpen).toBe(true)
      }
    }
  })
})
