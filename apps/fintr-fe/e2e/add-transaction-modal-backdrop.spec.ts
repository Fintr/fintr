import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

test.describe("Add Transaction modal backdrop", () => {
  test("closes when clicking the dimmed backdrop (desktop)", async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)

    const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
    await expect(addButton).toBeVisible({ timeout: 15000 })
    await addButton.click()

    const modalTitle = page.getByRole("heading", { name: "Add Transaction" })
    await expect(modalTitle).toBeVisible({ timeout: 10000 })

    const backdrop = page.getByTestId("custom-modal-backdrop")
    await expect(backdrop).toBeVisible()
    await backdrop.click({ position: { x: 24, y: 400 } })

    await expect(modalTitle).toBeHidden({ timeout: 5000 })
  })
})
