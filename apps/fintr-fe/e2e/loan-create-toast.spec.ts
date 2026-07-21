import { test, expect, Page } from "@playwright/test"
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

const MOCK_USER = {
  space_code: "TEST-SPACE-LOAN-TOAST",
}

async function mockLoanCreateFlow(page: Page) {
  const dashboard = buildDashboardApiJson({ monthlyExpenses: 0 })
  dashboard.data.dashboard.accountOptions = [
    { label: "Cash", value: "Cash", currency: "PHP" },
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
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: "entity-1", fullName: "Test Bank" },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ id: "entity-1", fullName: "Test Bank" }],
      }),
    })
  })

  await page.route("**/api/v1/transactions/loans**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "loan-e2e-1",
            principalAmount: 10000,
            interestRate: 5,
            loanType: "borrowed",
            entityName: "Test Bank",
            accountName: "Cash",
          },
        }),
      })
      return
    }

    await route.continue()
  })

  await page.route("**/api/v1/loans**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          loans: [],
          pagination: { page: 1, limit: 50, totalPages: 1, totalCount: 0 },
        },
      }),
    })
  })
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, { spaceCode: MOCK_USER.space_code })
  await primeWeeklyFeedbackDismissed(page)
}

async function openAddTransaction(page: Page) {
  const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
  await expect(addButton).toBeVisible({ timeout: 30_000 })
  await addButton.click()
  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10_000,
  })
}

async function selectGridPickerValue(page: Page, triggerId: string, label: string) {
  await page.locator(`#${triggerId}`).click()
  await page.getByRole("button", { name: label, exact: true }).click()
}

async function selectEntity(page: Page, entityName: string) {
  await page.getByRole("button", { name: "+ Add New Lender" }).click()
  await page.locator("#new-entity-name").fill(entityName)
  await page.getByRole("button", { name: "Add", exact: true }).click()
}

test.describe("Loan creation toast", () => {
  test.describe.configure({ timeout: 90_000 })
  test.use({ viewport: { width: 1280, height: 900 } })

  test("shows only the success toast after creating a loan", async ({ page }) => {
    await mockLoanCreateFlow(page)
    await setupAuth(page)
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" })

    await openAddTransaction(page)
    await page.locator('[data-tutorial-target="loan-tab"]').click()

    await page.locator("#loan-amount").fill("10000")
    await page.getByText("Interest Rate (%)").click()
    await page.locator("#loan-interest-rate").fill("5")
    await page.locator("#loan-term").fill("5")
    await selectEntity(page, "Test Bank")
    await selectGridPickerValue(page, "loan-account", "Cash")

    await page.getByRole("button", { name: "Create Loan" }).click()

    await expect(page.getByText("Loan created successfully")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Failed to create loan. Please try again.")).toHaveCount(0)
  })
})
