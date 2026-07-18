import { test, expect, Page } from "@playwright/test"
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

const MOCK_USER = {
  space_code: "TEST-SPACE-FX-EDIT",
}

type StoredTransaction = {
  id: string
  amount: number
  originalAmount: number
  originalCurrency: string
  exchangeRate: number
  exchangeRateSource: string
  note: string
  categoryName: string
  accountName: string
  date: string
}

function buildTransactionDetail(txn: StoredTransaction) {
  return {
    id: txn.id,
    amount: txn.amount,
    amountCurrency: "PHP",
    originalDisplayAmount: txn.originalAmount,
    originalDisplayCurrency: txn.originalCurrency,
    description: txn.note,
    categoryName: txn.categoryName,
    accountName: txn.accountName,
    transactionDate: txn.date,
    date: txn.date,
    scheduleType: "one_time",
    transactionType: "expense",
    type: "expense",
    hasCurrencyConversion: true,
    currencyConversion: {
      originalAmount: txn.originalAmount,
      originalCurrency: txn.originalCurrency,
      convertedAmount: txn.amount,
      convertedCurrency: "PHP",
      exchangeRate: txn.exchangeRate,
      source: txn.exchangeRateSource,
    },
  }
}

function buildIndexRow(txn: StoredTransaction) {
  return {
    id: txn.id,
    date: txn.date,
    description: txn.note,
    amount: txn.amount,
    amountCurrency: "PHP",
    categoryName: txn.categoryName,
    fromAccountName: txn.accountName,
    toAccountName: "",
    type: "expense",
    inSeries: false,
    hasImage: false,
  }
}

async function mockExchangeRateEditFlow(
  page: Page,
  transactions: StoredTransaction[],
  onUpdate?: (payload: Record<string, unknown>) => void,
) {
  const dashboard = buildDashboardApiJson({ monthlyExpenses: 0 })
  dashboard.data.dashboard.accountOptions = [
    { label: "GCash", value: "GCash", currency: "PHP" },
  ]
  dashboard.data.dashboard.expenseCategoryOptions = [
    {
      id: "cat-food",
      label: "Food",
      value: "cat-food",
      name: "Food",
      parentId: null,
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

  await page.route("**/api/v1/exchange_rates/**", async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith("/current")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            rate: 82.952,
            from_currency: url.searchParams.get("from_currency"),
            to_currency: url.searchParams.get("to_currency"),
            source: "api",
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          rates: [{ rate: 1, usedAt: "2026-07-19T00:00:00.000Z" }],
          source: "recent",
        },
      }),
    })
  })

  await page.route("**/api/v1/transactions**", async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const pathname = url.pathname

    if (method === "POST" && pathname.endsWith("/transactions")) {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const exchangeRate = Number(body.exchange_rate ?? body.exchangeRate ?? 1)
      const originalAmount = Number(body.amount ?? 0)
      const bookedAmount = Math.round(originalAmount * exchangeRate * 100) / 100

      const txn: StoredTransaction = {
        id: `txn-${Date.now()}`,
        amount: bookedAmount,
        originalAmount,
        originalCurrency: String(body.original_currency ?? body.originalCurrency ?? "GBP"),
        exchangeRate,
        exchangeRateSource: String(body.exchange_rate_source ?? body.exchangeRateSource ?? "manual"),
        note: String(body.description ?? ""),
        categoryName: String(body.category_name ?? body.categoryName ?? "Food"),
        accountName: String(body.account_name ?? body.accountName ?? "GCash"),
        date: String(body.date ?? body.transaction_date ?? "2026-07-19"),
      }

      transactions.push(txn)

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: buildTransactionDetail(txn) }),
      })
      return
    }

    const detailMatch = pathname.match(/\/transactions\/([^/]+)$/)
    if (detailMatch && method === "GET") {
      const txn = transactions.find((item) => item.id === detailMatch[1])
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: txn ? buildTransactionDetail(txn) : null,
        }),
      })
      return
    }

    if (detailMatch && method === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>
      onUpdate?.(body)
      const txn = transactions.find((item) => item.id === detailMatch[1])

      if (!txn) {
        await route.fulfill({ status: 404, body: JSON.stringify({ error: "not found" }) })
        return
      }

      const exchangeRate = Number(body.exchange_rate ?? body.exchangeRate ?? txn.exchangeRate)
      const originalAmount = Number(body.amount ?? txn.originalAmount)
      txn.originalAmount = originalAmount
      txn.exchangeRate = exchangeRate
      txn.exchangeRateSource = String(
        body.exchange_rate_source ?? body.exchangeRateSource ?? txn.exchangeRateSource,
      )
      txn.amount = Math.round(originalAmount * exchangeRate * 100) / 100
      txn.note = String(body.description ?? txn.note)

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: buildTransactionDetail(txn) }),
      })
      return
    }

    if (method === "GET" && pathname.endsWith("/transactions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            transactions: transactions.map(buildIndexRow),
            pagination: {
              page: 1,
              limit: 50,
              totalPages: 1,
              totalCount: transactions.length,
            },
            totals: null,
          },
        }),
      })
      return
    }

    await route.continue()
  })
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, { spaceCode: MOCK_USER.space_code })
  await primeWeeklyFeedbackDismissed(page)
}

async function openAddTransaction(page: Page) {
  const viewport = page.viewportSize()
  const useMobileEntry = viewport != null && viewport.width < 768

  if (useMobileEntry) {
    const mobileFab = page.locator('[data-tutorial-target="mobile-add-button"]')
    await expect(mobileFab).toBeVisible({ timeout: 30_000 })
    await mobileFab.click()
    const mobileAdd = page.locator('[data-tutorial-target="mobile-add-transaction"]')
    await expect(mobileAdd).toBeVisible({ timeout: 5000 })
    await mobileAdd.dispatchEvent("pointerdown")
    await page.waitForTimeout(250)
    return
  }

  const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
  await expect(addButton).toBeVisible({ timeout: 30_000 })
  await addButton.click()
  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10_000,
  })
}

async function selectAmountCurrency(page: Page, currencyCode: string) {
  await page.getByRole("button", { name: "Amount currency" }).click()
  await page.getByPlaceholder("Search by name or code...").fill(currencyCode)
  await page.getByRole("button", { name: new RegExp(`${currencyCode}\\)`, "i") }).first().click()
}

async function applyManualExchangeRate(page: Page, rate: string) {
  await page.getByRole("button", { name: "Exchange rate options" }).click()
  const manualRateInput = page.getByPlaceholder(/PHP per 1 GBP/i)
  await expect(manualRateInput).toBeVisible({ timeout: 5_000 })
  await manualRateInput.fill(rate)
  await page.getByRole("button", { name: /Applied|Apply/ }).click()
  await expect(page.getByRole("button", { name: "Applied" })).toBeVisible()
}

async function selectGridPickerValue(page: Page, triggerId: string, label: string) {
  await page.locator(`#${triggerId}`).click()
  await page.getByRole("button", { name: label, exact: true }).click()
}

test.describe("Edit transaction exchange rate", () => {
  test.describe.configure({ timeout: 90_000 })
  test.use({ viewport: { width: 1280, height: 900 } })

  test("updates booked PHP amount when exchange rate changes on edit", async ({ page }) => {
    const transactions: StoredTransaction[] = []
    let updatePayload: Record<string, unknown> | null = null

    await mockExchangeRateEditFlow(page, transactions, (payload) => {
      updatePayload = payload
    })

    await setupAuth(page)
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" })

    await openAddTransaction(page)

    await selectGridPickerValue(page, "accountName", "GCash")
    await page.locator("#amount").fill("100")
    await selectAmountCurrency(page, "GBP")
    await applyManualExchangeRate(page, "1")
    await selectGridPickerValue(page, "category", "Food")
    await page.locator("#description").fill("GBP coffee expense")

    await page.getByRole("button", { name: "Add Expense" }).click()
    await expect(page.getByText("Expense created successfully")).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText("₱100.00").first()).toBeVisible({ timeout: 10_000 })

    await page.getByText("GBP coffee expense").click()
    await expect(page.getByRole("heading", { name: "Edit Expense" })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator("#amount")).toHaveValue("100")

    await applyManualExchangeRate(page, "80")
    await expect(page.getByText(/8,?000/)).toBeVisible()

    await page.getByRole("button", { name: "Update Expense" }).click()
    await expect(page.getByRole("heading", { name: "Edit Expense" })).toBeHidden({
      timeout: 10_000,
    })

    expect(updatePayload).not.toBeNull()
    expect(Number(updatePayload?.exchange_rate ?? updatePayload?.exchangeRate)).toBe(80)
    expect(Number(updatePayload?.amount)).toBe(100)

    await expect(page.getByText("₱8,000.00").first()).toBeVisible({ timeout: 10_000 })

    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByText("₱8,000.00").first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("₱100.00")).toHaveCount(0)
  })
})
