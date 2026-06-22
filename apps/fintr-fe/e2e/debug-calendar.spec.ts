import { test } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

/**
 * Debug test to see what's happening with calendar overlay close
 */

test.describe("CalendarPopover debug", () => {
  test("debug calendar overlay click", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const addButton = page.locator("button:has-text('Add Transaction'), button:has-text('Add')").first()
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      const dateButton = page.locator("button:has-text('Pick a date')").first()
      if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dateButton.click()
        await page.waitForTimeout(800)

        const sheet = page.locator('[data-state="open"]').first()
        if (await sheet.isVisible().catch(() => false)) {
          await page.screenshot({ path: "debug-calendar-open.png", fullPage: true })
          
          const calendar = page.locator(".rdp")
          const calendarBox = await calendar.boundingBox()
          console.log("Calendar bounding box:", calendarBox)
          
          if (calendarBox) {
            const overlayAboveCalendar = {
              x: 10,
              y: 10,
              width: 370,
              height: calendarBox.y - 20
            }
            console.log("Overlay area above calendar:", overlayAboveCalendar)
            
            await page.mouse.click(overlayAboveCalendar.x + overlayAboveCalendar.width / 2, overlayAboveCalendar.y + overlayAboveCalendar.height / 2)
            await page.waitForTimeout(500)
            
            await page.screenshot({ path: "debug-after-overlay-click.png", fullPage: true })
            
            const openSheets = await page.locator('[data-state="open"]').count()
            console.log("Open sheets after clicking above calendar:", openSheets)
          }
        }
      }
    }
  })
})
