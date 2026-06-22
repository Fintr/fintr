import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

/**
 * Test clicking directly on the Sheet overlay element
 */

test.describe("CalendarPopover overlay click", () => {
  test("click directly on overlay element", async ({ page }) => {
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

        const openSheet = page.locator('[data-state="open"]').first()
        if (await openSheet.isVisible().catch(() => false)) {
          const sheetOverlay = page.locator('[data-state="open"]').first().locator("..").locator("..").locator("div").first()
          
          const overlayInfo = await page.evaluate(() => {
            const overlays = document.querySelectorAll('[data-state="open"]')
            for (const overlay of overlays) {
              const parent = overlay.parentElement
              if (parent && parent.classList.contains('fixed')) {
                const style = window.getComputedStyle(parent)
                return {
                  tagName: parent.tagName,
                  className: parent.className,
                  zIndex: style.zIndex,
                  position: style.position,
                  top: style.top,
                  left: style.left,
                  right: style.right,
                  bottom: style.bottom,
                  pointerEvents: style.pointerEvents
                }
              }
            }
            return null
          })
          console.log("Overlay element info:", JSON.stringify(overlayInfo, null, 2))

          const calendarBox = await page.locator(".rdp").boundingBox()
          console.log("Calendar box:", calendarBox)
          
          if (calendarBox) {
            const clickX = 195
            const clickY = 50
            console.log(`Clicking at (${clickX}, ${clickY})`)
            await page.mouse.click(clickX, clickY)
            await page.waitForTimeout(500)
            
            const openCount = await page.locator('[data-state="open"]').count()
            console.log(`Open sheets after click: ${openCount}`)
            expect(openCount).toBe(0)
          }
        }
      }
    }
  })
})
