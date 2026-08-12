import type { Page } from "@playwright/test";

import { buildDashboardApiJson } from "./dashboard-api-mock";

const emptyListResponse = {
  status: 200 as const,
  contentType: "application/json",
  body: JSON.stringify({ success: true, data: [] }),
};

const minimalBootstrapPayload = (spaceCode: string) => ({
  spaceId: spaceCode,
  latestSeq: 1,
  snapshotId: "e2e-bootstrap",
  generatedAt: "2020-01-01T00:00:00.000Z",
  totals: {
    transactions: 0,
    loans: 0,
    budgetMonths: 0,
    truncated: false,
  },
  space: {
    id: "space-1",
    name: "Test Space",
    code: spaceCode,
  },
  dashboardShell: buildDashboardApiJson().data.dashboard,
  accounts: [],
  categories: [],
  tags: [],
  entities: [],
  transactions: [],
  monthlyFinancialSummaries: [],
  loans: [],
  budgetsByMonth: {},
});

export async function mockOfflineNavigationApi(
  page: Page,
  spaceCode = "test-space",
): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });

  await page.route("**/api/v1/auth/private", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          spaceCode,
          isAdmin: false,
          onboardingStep: "completed",
          desktopTutorial: true,
          mobileTutorial: true,
        },
      }),
    });
  });

  await page.route("**/api/v1/spaces**", async (route) => {
    const url = route.request().url();

    if (url.includes("/sync/bootstrap")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: minimalBootstrapPayload(spaceCode),
        }),
      });
      return;
    }

    if (url.includes("/sync/changes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            changes: [],
            latestSeq: 1,
            hasMore: false,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [
          {
            id: "space-1",
            name: "Test Space",
            code: spaceCode,
            is_organization: false,
          },
        ],
        current_space: {
          id: "space-1",
          name: "Test Space",
          code: spaceCode,
        },
      }),
    });
  });

  await page.route("**/api/v1/dashboard*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildDashboardApiJson({ monthlyExpenses: 0 })),
    });
  });

  await page.route("**/api/v1/monthly_financial_summaries**", async (route) => {
    await route.fulfill(emptyListResponse);
  });

  await page.route("**/api/v1/insights**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          summaryStructure: {
            totalIncome: "0",
            totalExpenses: "0",
            netSavings: "0",
          },
          healthScores: {
            savingsPercentage: { percentage: "10%", score: 10 },
            debtToIncomeRatio: {
              percentage: "0%",
              score: 100,
              monthlyDebt: "0",
            },
            budgetUsage: { percentage: "5%", score: 5 },
            financialHealthScore: "75%",
          },
          expenseBreakdown: [],
          weeklySpending: [],
          monthlySpending: [],
          accountBreakdown: {
            totalBalance: "0",
            breakdown: [],
          },
        },
      }),
    });
  });

  await page.route("**/api/v1/transactions**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          transactions: [],
          pagination: { page: 1, limit: 50, totalPages: 1, totalCount: 0 },
          totals: null,
        },
      }),
    });
  });

  await page.route("**/api/v1/cache_version", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { cacheVersion: "e2e", updatedAt: null },
      }),
    });
  });

  await page.route("**/api/v1/conversations**", async (route) => {
    await route.fulfill(emptyListResponse);
  });

  await page.route("**/api/v1/ai**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { usage: 0, limit: 100 },
      }),
    });
  });

  await page.route("**/api/v1/product_pulse**", async (route) => {
    await route.fulfill(emptyListResponse);
  });

  await page.route("**/api/v1/gamification**", async (route) => {
    await route.fulfill(emptyListResponse);
  });
}
