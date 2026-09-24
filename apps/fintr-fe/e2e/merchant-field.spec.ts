import { test, expect, Page } from "@playwright/test"
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

async function mockMerchantFlow(page: Page) {
  const dashboard = buildDashboardApiJson({ monthlyExpenses: 0 })
  dashboard.data.dashboard.accountOptions = [
    { label: "Cash", value: "Cash", currency: "PHP" },
  ]
  dashboard.data.dashboard.expenseCategoryOptions = [
  {
    id: "cat-food",
    name: "Food",
    label: "Food",
    value: "Food",
    children: [],
  },
  ]

  await mockCommonDashboardApi(page, { monthlyExpenses: 0 })

  await page.route("**/api/v1/dashboard*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboard),
    })
  })

  await page.route("**/api/v1/entities**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { full_name?: string }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: "merchant-1", fullName: body.full_name ?? "Jollibee" },
        }),
      })
      return
    }

    const url = new URL(route.request().url())
    const search = url.searchParams.get("search") ?? ""

    const merchants =
      search.length === 0
        ? []
        : search.toLowerCase().includes("joll")
          ? [{ id: "merchant-1", fullName: "Jollibee" }]
          : []

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: merchants }),
    })
  })
}

async function openExpenseForm(page: Page) {
  await setAuthStorageForE2e(page)
  await primeWeeklyFeedbackDismissed(page)
  await mockMerchantFlow(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/dashboard/", { waitUntil: "domcontentloaded", timeout: 60000 })

  const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
  await expect(addButton).toBeVisible({ timeout: 15000 })
  await addButton.click()

  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10000,
  })
}

test.describe("Expense merchant field", () => {
  test.describe.configure({ timeout: 60_000 })

  test("shows Merchant label and helpful empty state instead of bare no results", async ({
    page,
  }) => {
    await openExpenseForm(page)

    await expect(page.getByText("Merchant", { exact: true })).toBeVisible()
    await expect(page.getByText("Payee")).toHaveCount(0)

    const merchantInput = page.getByPlaceholder("Search merchants…")
    await merchantInput.click()

    await expect(page.getByText("No merchants yet")).toBeVisible()
    await expect(page.getByRole("button", { name: "Add merchant" }).first()).toBeVisible()
    await expect(page.getByText("No results found")).toHaveCount(0)
  })

  test("can add a merchant from the inline panel", async ({ page }) => {
    await openExpenseForm(page)

    await page.getByRole("button", { name: "Add merchant" }).first().click()
    await page.locator("#new-entity-name").fill("Jollibee")
    await page.getByRole("button", { name: "Save", exact: true }).click()

    await expect(page.getByPlaceholder("Search merchants…")).toHaveValue("Jollibee")
  })

  test("offers quick create when search has no match", async ({ page }) => {
    await openExpenseForm(page)

    const merchantInput = page.getByPlaceholder("Search merchants…")
    await merchantInput.fill("Shopee")
    await merchantInput.click()

    await expect(page.getByRole("button", { name: 'Add "Shopee"' })).toBeVisible()
  })
})
