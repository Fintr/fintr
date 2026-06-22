import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

test.describe("Filter sheet", () => {
  test("opens transactions filter sheet with visible panel and controls", async ({
    page,
  }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)

    const filterButton = page.getByRole("button", { name: "Open transaction filters" })
    await expect(filterButton).toBeVisible({ timeout: 10000 })
    await filterButton.click()

    const filterHeading = page.getByRole("heading", { name: "Transaction Filters" })
    await expect(filterHeading).toBeVisible({ timeout: 5000 })

    const filterSheet = page.getByRole("dialog").filter({
      has: filterHeading,
    })

    const customRange = filterSheet.getByRole("radio", { name: "Custom Range" })
    await expect(customRange).toBeVisible()

    await expect(filterSheet).toBeInViewport()

    const overlay = page.locator(".fixed.inset-0.bg-black\\/40").first()
    await expect(overlay).toBeVisible()
  })

  test("closes filter sheet from Apply", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)

    const filterButton = page.getByRole("button", { name: "Open transaction filters" })
    await expect(filterButton).toBeVisible({ timeout: 10000 })
    await filterButton.click()

    const filterHeading = page.getByRole("heading", { name: "Transaction Filters" })
    await expect(filterHeading).toBeVisible({ timeout: 5000 })

    const filterSheet = page.getByRole("dialog").filter({
      has: filterHeading,
    })

    await filterSheet.getByRole("button", { name: "Apply" }).click()
    await expect(filterHeading).toBeHidden({ timeout: 5000 })
  })
})
