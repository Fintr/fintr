import { test, expect, Page } from "@playwright/test";
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { getCurrentIsoWeekKey } from "@/config/weekly-feedback";

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
      debtToIncomeRatio: "0",
      budgetUsage: { percentage: "5%", score: 5 },
      financialHealthScore: "75",
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(minimalInsightsResponse),
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
  const domain = auth0LocalStorageKeySuffix();
  const mockTokens = {
    access_token: "mock_token",
    id_token: "mock_id_token",
    refresh_token: "mock_refresh",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "openid profile email",
  };
  const expiresAt = Date.now() + 3_600_000;
  const weekKey = getCurrentIsoWeekKey(new Date());
  await page.addInitScript(
    ({ domain, mockTokens, expiresAt, weekKey }) => {
      localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token);
      localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token);
      localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token || "");
      localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString());
      localStorage.setItem(
        `@@auth0@@.user.${domain}`,
        JSON.stringify({ sub: "user123", email: "test@example.com", name: "Test User" })
      );
      localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope);
      localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString());
      localStorage.setItem(
        "fintr_auth_data",
        JSON.stringify({
          tokens: mockTokens,
          user: { sub: "user123", email: "test@example.com", name: "Test User" },
        })
      );
      localStorage.setItem("spaceCode", "TEST-SPACE-INSIGHTS");
      localStorage.setItem("fintr_weekly_feedback_v1_lastActionAt", String(Date.now()));
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", weekKey);
    },
    { domain, mockTokens, expiresAt, weekKey }
  );
}

test.describe("Insights account breakdown", () => {
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
