import { test, expect, Page } from "@playwright/test";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const MOCK_USER = {
  user_id: "e2e-insights-user",
  email: "e2e-insights@fintr.local",
  auth_id: "e2e-insights-auth",
  space_code: "TEST-SPACE-INSIGHTS",
};

const minimalInsightsResponse = {
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
      totalBalance: "5000",
      breakdown: [
        {
          name: "E2E Savings",
          balance: { cents: 500_000, currencyIso: "PHP" },
          percentage: "100%",
          category: "savings",
        },
      ],
    },
  },
};

async function mockInsightsFlowApi(page: Page) {
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
    });
  });

  await page.route("**/api/v1/e2e/reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Test data reset" }),
    });
  });

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
    });
  });

  await page.route("**/api/v1/spaces/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [
          {
            id: "space-insights-1",
            name: "Test Space",
            code: MOCK_USER.space_code,
            is_organization: false,
          },
        ],
        current_space: {
          id: "space-insights-1",
          name: "Test Space",
          code: MOCK_USER.space_code,
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

  await page.route("**/api/v1/insights**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const section = url.pathname.split("/").pop() || "insights";
    const payload = minimalInsightsResponse.data;

    let data: unknown = payload;
    if (section === "summary") {
      data = payload.summaryStructure;
    } else if (section === "health_scores") {
      data = payload.healthScores;
    } else if (section === "expense_breakdown") {
      data = payload.expenseBreakdown;
    } else if (section === "weekly_spending") {
      data = payload.weeklySpending;
    } else if (section === "monthly_spending") {
      data = payload.monthlySpending;
    } else if (section === "account_breakdown") {
      data = payload.accountBreakdown;
    } else if (section === "narratives") {
      data = {
        headline: { text: "You kept ₱0 this period.", sentiment: "positive" },
        metrics: [],
        insights: [],
        dataQuality: {
          transactionCount: 0,
          categorizedPercent: "0%",
          completenessTier: "sparse",
        },
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Success", data }),
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
          transactions: [
            {
              id: "e2e-txn-1",
              date: "2024-01-15",
              description: "E2E Coffee",
              amount: -50,
              categoryName: "Food",
              fromAccountName: "",
              toAccountName: "E2E Savings",
              type: "expense",
              inSeries: false,
              hasImage: false,
            },
          ],
          pagination: {
            page: 1,
            limit: 50,
            totalPages: 1,
            totalCount: 1,
          },
        },
      }),
    });
  });
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, {
    spaceCode: "TEST-SPACE-INSIGHTS",
  })
  await primeWeeklyFeedbackDismissed(page)
}

test.describe.skip("Insights account breakdown", () => {
  test.describe.configure({ timeout: 60_000 });

  test("expanding an account requests transactions with that accountName", async ({ page }) => {
    await mockInsightsFlowApi(page);
    await setupAuth(page);

    const transactionsRequest = page.waitForRequest((req) => {
      if (req.method() !== "GET") {
        return false;
      }
      const url = req.url();
      if (!url.includes("/transactions")) {
        return false;
      }
      try {
        const u = new URL(url);
        return u.searchParams.get("accountName") === "E2E Savings";
      } catch {
        return false;
      }
    });

    await page.goto("/dashboard/insights", { waitUntil: "domcontentloaded" });

    const heading = page.getByText("Account Breakdown", { exact: true });
    await expect(heading).toBeVisible({ timeout: 30_000 });
    await heading.scrollIntoViewIfNeeded();

    await page.getByText("E2E Savings", { exact: true }).click();

    const req = await transactionsRequest;
    const transactionUrl = new URL(req.url());
    expect(transactionUrl.searchParams.get("accountName")).toBe("E2E Savings");

    await expect(page.getByText("E2E Coffee")).toBeVisible({ timeout: 15_000 });
  });
});
