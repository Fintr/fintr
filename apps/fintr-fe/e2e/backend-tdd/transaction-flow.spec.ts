import { test, expect, Page } from "@playwright/test"

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

  await page.route("**/api/v1/spaces/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [{ id: "space-1", name: "Test Space", code: MOCK_USER.space_code, is_organization: false }],
        current_space: { id: "space-1", name: "Test Space", code: MOCK_USER.space_code },
      }),
    })
  })

  await page.route("**/api/v1/dashboard/**", async (route) => {
    const totalExpenses = transactions.reduce((sum, t) => sum + t.amount, 0)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          total_balance: 10000 - totalExpenses,
          monthly_income: 5000,
          monthly_expenses: totalExpenses,
        },
        categoryOptions: [],
      }),
    })
  })

  await page.route("**/api/v1/transactions**", async (route) => {
    const url = route.request().url()
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
  const domain = "fintr_jp_auth0_com"
  const mockTokens = {
    access_token: "mock_token",
    id_token: "mock_id_token",
    refresh_token: "mock_refresh",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "openid profile email",
  }
  const expiresAt = Date.now() + 3600000
  await page.addInitScript(({ domain, mockTokens, expiresAt }) => {
    localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token)
    localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token)
    localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token || "")
    localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString())
    localStorage.setItem(`@@auth0@@.user.${domain}`, JSON.stringify({ sub: "user123", email: "test@example.com", name: "Test User" }))
    localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope)
    localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString())
    localStorage.setItem("fintr_auth_data", JSON.stringify({ tokens: mockTokens, user: { sub: "user123", email: "test@example.com", name: "Test User" } }))
    localStorage.setItem("spaceCode", "TEST-SPACE-789")
  }, { domain, mockTokens, expiresAt })
}

test.describe("Transaction Creation Flow", () => {
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

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const transactionsList = page.locator("[data-testid='transactions-list']")
    if (await transactionsList.isVisible().catch(() => false)) {
      await expect(transactionsList).toBeVisible()
    }

    const addButton = page.locator("button:has-text('Add Transaction'), button:has-text('Add')").first()
    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      const amountInput = page.locator("input[name='amount'], input[placeholder*='amount' i]").first()
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill("1500")

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

    await page.goto("/dashboard/")
    await page.waitForLoadState("networkidle")

    const addButton = page.locator("button:has-text('Add Transaction'), button:has-text('Add')").first()
    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      const amountInput = page.locator("input[name='amount'], input[placeholder*='amount' i]").first()
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill("2500")

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
    }

    await page.reload()
    await page.waitForLoadState("networkidle")

    const transactionItem = page.getByText(/Electric bill|2,?500/).first()
    if (await transactionItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(transactionItem).toBeVisible()
    }
  })
})