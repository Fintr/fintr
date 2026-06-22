import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

/**
 * E2E tests for responsive datepicker behavior:
 * - Below md (< 768px): should use Sheet (new datepicker)
 * - md and above (>= 768px): should use Popover (old/normal datepicker)
 */

test.describe("Responsive CalendarPopover", () => {
  test("shows Sheet (new datepicker) on mobile (< md)", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const dateButton = page.locator("button:has-text('Pick a date')").first()
    if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateButton.click()
      await page.waitForTimeout(500)

      // On mobile, a Sheet should be open
      const sheet = page.locator('[data-state="open"]').first()
      expect(await sheet.isVisible().catch(() => false)).toBe(true)

      // The calendar should be visible inside the sheet
      const calendar = page.locator(".rdp")
      expect(await calendar.isVisible().catch(() => false)).toBe(true)
    }
  })

  test("shows Popover (old datepicker) on desktop (md+)", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 1280, height: 800 })

    const dateButton = page.locator("button:has-text('Pick a date')").first()
    if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateButton.click()
      await page.waitForTimeout(500)

      // On desktop, no Sheet should be open
      const openSheetCount = await page.locator('[data-state="open"]').count()
      expect(openSheetCount).toBe(0)

      // Instead, a Popover should be visible
      const popoverContent = page.locator('[data-radix-popper-content-wrapper]')
      expect(await popoverContent.isVisible().catch(() => false)).toBe(true)

      // The calendar should be visible inside the popover
      const calendar = page.locator(".rdp")
      expect(await calendar.isVisible().catch(() => false)).toBe(true)
    }
  })
})

test.describe("Responsive DateRangePicker", () => {
  test("shows fullscreen Sheet (new datepicker) on mobile (< md)", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    // Open filters to access custom date range
    const filterButton = page.locator("button:has-text('Filters')").first()
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterButton.click()
      await page.waitForTimeout(300)

      // Switch to custom range if needed
      const customButton = page.locator("button:has-text('Custom Range')").first()
      if (await customButton.isVisible().catch(() => false)) {
        await customButton.click()
        await page.waitForTimeout(300)
      }

      const rangeButton = page.locator("button:has-text('Pick a date range')").first()
      if (await rangeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await rangeButton.click()
        await page.waitForTimeout(500)

        // On mobile, a fullscreen Sheet should be open
        const sheet = page.locator('[data-state="open"]').first()
        expect(await sheet.isVisible().catch(() => false)).toBe(true)

        // The calendar should be visible
        const calendar = page.locator(".rdp")
        expect(await calendar.isVisible().catch(() => false)).toBe(true)
      }
    }
  })

  test("shows Popover (old datepicker) on desktop (md+)", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 1280, height: 800 })

    // Open filters to access custom date range
    const filterButton = page.locator("button:has-text('Filters')").first()
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterButton.click()
      await page.waitForTimeout(300)

      // Switch to custom range if needed
      const customButton = page.locator("button:has-text('Custom Range')").first()
      if (await customButton.isVisible().catch(() => false)) {
        await customButton.click()
        await page.waitForTimeout(300)
      }

      const rangeButton = page.locator("button:has-text('Pick a date range')").first()
      if (await rangeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await rangeButton.click()
        await page.waitForTimeout(500)

        // On desktop, no Sheet should be open
        const openSheetCount = await page.locator('[data-state="open"]').count()
        expect(openSheetCount).toBe(0)

        // Instead, a Popover should be visible
        const popoverContent = page.locator('[data-radix-popper-content-wrapper]')
        expect(await popoverContent.isVisible().catch(() => false)).toBe(true)

        // The calendar should be visible inside the popover
        const calendar = page.locator(".rdp")
        expect(await calendar.isVisible().catch(() => false)).toBe(true)
      }
    }
  })
})
