import type { Page } from "@playwright/test"

export type DashboardMockOverrides = {
  monthlyExpenses?: number
}

export function buildDashboardApiJson(overrides?: DashboardMockOverrides) {
  const monthlyExpenses = overrides?.monthlyExpenses ?? 3000
  return {
    data: {
      dashboard: {
        id: "e2e-dashboard",
        categoryOptions: [],
        accountOptions: [],
        expenseCategoryOptions: [],
        incomeCategoryOptions: [],
        goalDescription: "E2E goal",
        financialSummary: {
          totalIncome: "5000",
          totalExpenses: String(monthlyExpenses),
          netSavings: String(10000 - monthlyExpenses),
          savingsPercentage: "40",
          calculatedAt: "2020-01-01T00:00:00.000Z",
        },
      },
    },
  }
}

export async function routeDashboardApi(page: Page, overrides?: DashboardMockOverrides) {
  await page.route("**/api/v1/dashboard*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildDashboardApiJson(overrides)),
    })
  })
}
