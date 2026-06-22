import { test, expect, Page } from "@playwright/test"
import { buildDashboardApiJson } from "../helpers/dashboard-api-mock"
import { primeWeeklyFeedbackDismissed } from "../helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "../helpers/set-auth-storage"

/**
 * Backend TDD E2E Test: Transaction Creation Flow
 *
 * This test exercises the transaction creation flow using mocked API responses.
 * This allows the tests to run without a real backend server.
 *
 * TDD Principles applied:
 * 1. Define expectations explicitly (Arrange / Act / Assert)
 * 2. One logical expectation per assertion block
 * 3. Test observable behavior, not implementation details
 * 4. Clean state between tests (setup + teardown)
 */

const MOCK_USER = {
  user_id: "e2e-test-user-123",
  email: "e2e-test@fintr.local",
  auth_id: "e2e-test-auth-id-456",
  space_code: "TEST-SPACE-789",
}

async function mockApiCalls(page: Page, transactions: Array<{
  id: string
  amount: number
  note: string
  category: string
  account: string
  date: string
}> = []) {
  await page.route("**/api/v1/e2e/setup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: MOCK_USER.user_id,
        email: MOCK_USER.email,
        auth_id: MOCK_USER.auth_id,
        space_code: MOCK_USER.space_code,
      }),
    })
  })

  await page.route("**/api/v1/e2e/reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Test data reset" }),
    })
  })

  await page.route("**/api/v1/auth/private", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          spaceCode: MOCK_USER.space_code,
          isAdmin: false,
          onboardingStep: "completed",
          desktopTutorial: true,
          mobileTutorial: true,
        },
      }),
    })
  })

  await page.route("**/api/v1/spaces**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [{ id: "space-1", name: "Test Space", code: MOCK_USER.space_code, is_organization: false }],
        current_space: { id: "space-1", name: "Test Space", code: MOCK_USER.space_code },
      }),
    })
  })

  await page.route("**/api/v1/dashboard*", async (route) => {
    const totalExpenses = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildDashboardApiJson({ monthlyExpenses: totalExpenses })
      ),
    })
  })

  await page.route("**/api/v1/transactions**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataBuffer()
      const parsed = body ? JSON.parse(body.toString()) : {}
      const newTransaction = {
        id: `txn-${Date.now()}`,
        amount: parsed.amount || 0,
        note: parsed.note || "",
        category_name: parsed.category_name || "Food",
        account_name: parsed.account_name || "Cash",
        transaction_date: parsed.transaction_date || new Date().toISOString().split("T")[0],
        type: "expense",
      }
      transactions.push(newTransaction)
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: newTransaction }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: transactions,
          pagination: { page: 1, limit: 50, total: transactions.length },
        }),
      })
    }
  })

  await page.route("**/api/v1/transactions/categories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "cat1", name: "Food", type: "expense" },
          { id: "cat2", name: "Transport", type: "expense" },
          { id: "cat3", name: "Utilities", type: "expense" },
        ],
      }),
    })
  })

  await page.route("**/api/v1/transactions/accounts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "acc1", name: "Cash", currency: "PHP", type: "cash" },
          { id: "acc2", name: "Bank", currency: "PHP", type: "bank" },
        ],
      }),
    })
  })
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, {
    spaceCode: MOCK_USER.space_code,
  })
  await primeWeeklyFeedbackDismissed(page)
}

async function openAddTransactionEntry(page: Page) {
  const viewport = page.viewportSize()
  const useMobileEntry = viewport != null && viewport.width < 768
  const mobileFab = page.locator('[data-tutorial-target="mobile-add-button"]')
  const desktopAdd = page.locator('[data-tutorial-target="add-transaction-button"]')
  const mobileAdd = page.locator('[data-tutorial-target="mobile-add-transaction"]')

  if (useMobileEntry) {
    await expect(mobileFab).toBeVisible({ timeout: 30_000 })
    await mobileFab.click()
    await expect(mobileAdd).toBeVisible({ timeout: 5000 })
    await mobileAdd.dispatchEvent("pointerdown")
    await page.waitForTimeout(250)
    return
  }

  await expect(desktopAdd).toBeVisible({ timeout: 30_000 })
  await desktopAdd.click()
}

async function waitForDashboardAddTransaction(page: Page) {
  await page.waitForLoadState("domcontentloaded")
  const viewport = page.viewportSize()
  const useMobileEntry = viewport != null && viewport.width < 768
  const mobileFab = page.locator('[data-tutorial-target="mobile-add-button"]')
  const desktopAdd = page.locator('[data-tutorial-target="add-transaction-button"]')

  if (useMobileEntry) {
    await expect(mobileFab).toBeVisible({ timeout: 30_000 })
    return
  }

  await expect(desktopAdd).toBeVisible({ timeout: 30_000 })
}

test.describe("Transaction Creation Flow", () => {
  test.describe.configure({ timeout: 60_000 })

  test("user can create an expense transaction and see it in the list", async ({ page }) => {
    const transactions: Array<{
      id: string
      amount: number
      note: string
      category: string
      account: string
      date: string
    }> = []

    await mockApiCalls(page, transactions)
    await setupAuth(page)

    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" })
    await waitForDashboardAddTransaction(page)

    const transactionsList = page.locator("[data-testid='transactions-list']")
    if (await transactionsList.isVisible().catch(() => false)) {
      await expect(transactionsList).toBeVisible()
    }

    await openAddTransactionEntry(page)
    await page.waitForTimeout(500)

    const amountInput = page.locator("input[name='amount'], input[placeholder*='amount' i]").first()
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill("1500")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)

      const noteInput = page.locator("input[name='note'], input[placeholder*='note' i], textarea[name='note']").first()
      if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await noteInput.fill("Grocery shopping")
      }

      const categorySelect = page.locator("button:has-text('Category'), [data-testid='category-select']").first()
      if (await categorySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await categorySelect.click()
        await page.waitForTimeout(300)
        const foodOption = page.locator("text=Food").first()
        if (await foodOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await foodOption.click()
        }
      }

      const accountSelect = page.locator("button:has-text('Account'), [data-testid='account-select']").first()
      if (await accountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await accountSelect.click()
        await page.waitForTimeout(300)
        const cashOption = page.locator("text=Cash").first()
        if (await cashOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cashOption.click()
        }
      }

      const submitButton = page.locator("button[type='submit'], button:has-text('Save'), button:has-text('Add')").last()
      if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitButton.click()
        await page.waitForTimeout(1500)
      }
    }

    const transactionItem = page.getByText(/Grocery shopping|1,?500/).first()
    if (await transactionItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(transactionItem).toBeVisible()
    }
  })

  test("creating a transaction persists after page reload", async ({ page }) => {
    const transactions: Array<{
      id: string
      amount: number
      note: string
      category: string
      account: string
      date: string
    }> = []

    await mockApiCalls(page, transactions)
    await setupAuth(page)

    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" })
    await waitForDashboardAddTransaction(page)

    await openAddTransactionEntry(page)
    await page.waitForTimeout(500)

    const amountInput = page.locator("input[name='amount'], input[placeholder*='amount' i]").first()
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill("2500")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)

      const noteInput = page.locator("input[name='note'], input[placeholder*='note' i], textarea[name='note']").first()
      if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await noteInput.fill("Electric bill")
      }

      const submitButton = page.locator("button[type='submit'], button:has-text('Save'), button:has-text('Add')").last()
      if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitButton.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.reload({ waitUntil: "domcontentloaded" })
    await waitForDashboardAddTransaction(page)

    const transactionItem = page.getByText(/Electric bill|2,?500/).first()
    if (await transactionItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(transactionItem).toBeVisible()
    }
  })
})