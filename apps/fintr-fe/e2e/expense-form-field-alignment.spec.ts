import { test, expect, Page, Locator } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

/** Tailwind h-10 / min-h-10 (40px) — shared form control height */
const EXPECTED_CONTROL_HEIGHT_PX = 40
const HEIGHT_TOLERANCE_PX = 2
const TOP_ALIGN_TOLERANCE_PX = 1

async function openExpenseForm(page: Page) {
  await setAuthStorageForE2e(page)
  await primeWeeklyFeedbackDismissed(page)
  await mockCommonDashboardApi(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/dashboard/", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForLoadState("domcontentloaded")

  const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
  await expect(addButton).toBeVisible({ timeout: 15000 })
  await addButton.click()

  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10000,
  })
  await expect(page.locator("#scheduleType")).toBeVisible({ timeout: 10000 })
}

async function expectStandardControlHeight(
  locator: Locator,
  label: string,
) {
  const box = await locator.boundingBox()
  expect(box, `${label} should be visible`).not.toBeNull()

  const height = box!.height
  expect(
    height,
    `${label} height should be ~${EXPECTED_CONTROL_HEIGHT_PX}px (got ${height}px)`,
  ).toBeGreaterThanOrEqual(EXPECTED_CONTROL_HEIGHT_PX - HEIGHT_TOLERANCE_PX)
  expect(
    height,
    `${label} height should be ~${EXPECTED_CONTROL_HEIGHT_PX}px (got ${height}px)`,
  ).toBeLessThanOrEqual(EXPECTED_CONTROL_HEIGHT_PX + HEIGHT_TOLERANCE_PX)
}

async function expectAlignedTops(a: Locator, b: Locator, label: string) {
  const boxA = await a.boundingBox()
  const boxB = await b.boundingBox()
  expect(boxA, `${label}: first control visible`).not.toBeNull()
  expect(boxB, `${label}: second control visible`).not.toBeNull()

  const topDelta = Math.abs(boxA!.y - boxB!.y)
  expect(
    topDelta,
    `${label}: controls should share the same row baseline (Δy=${topDelta}px)`,
  ).toBeLessThanOrEqual(TOP_ALIGN_TOLERANCE_PX)
}

test.describe("Expense form field alignment", () => {
  test.describe.configure({ timeout: 60_000 })

  test("paired fields align on every row of the expense form", async ({ page }) => {
    await openExpenseForm(page)

    const dateButton = page
      .locator('label[for="date"]')
      .locator('xpath=ancestor::div[contains(@class,"grid-rows")]/div[contains(@class,"flex")]')
      .getByRole("button")
      .first()
    const amountInput = page.locator("#amount")
    const scheduleType = page.locator("#scheduleType")
    const categoryPicker = page.locator("#category")
    const accountPicker = page.locator("#accountName")
    const description = page.locator("#description")
    const form = page.locator("form").filter({ has: page.locator("#scheduleType") }).first()

    await expectAlignedTops(dateButton, amountInput, "Date / Amount")

    const formWidth = (await form.boundingBox())?.width ?? 0
    const noteWidth = (await description.boundingBox())?.width ?? 0
    expect(formWidth).toBeGreaterThan(0)
    expect(noteWidth).toBeGreaterThan(formWidth * 0.9)

    await expect(page.locator("#scheduleType")).toBeVisible()
    await expect(page.getByRole("radio", { name: "One-Time" })).toBeVisible()
    await expect(page.getByRole("radio", { name: "Recurring" })).toBeVisible()

    for (const [locator, name] of [
      [dateButton, "Date"],
      [amountInput, "Amount"],
      [categoryPicker, "Category"],
      [accountPicker, "Account"],
    ] as const) {
      await expectStandardControlHeight(locator, name)
    }
  })
})
