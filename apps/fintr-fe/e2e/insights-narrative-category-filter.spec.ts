import { test, expect, Page } from "@playwright/test";
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { getCurrentIsoWeekKey } from "@/config/weekly-feedback";

const MOCK_USER = {
  user_id: "e2e-narrative-filter-user",
  email: "e2e-narrative-filter@fintr.local",
  auth_id: "e2e-narrative-filter-auth",
  space_code: "TEST-SPACE-NARRATIVE-FILTER",
};

const PARENT_ID = "11111111-1111-4111-8111-111111111111";

async function mockInsightsWithCategorySpike(page: Page) {
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
            id: "space-narrative-1",
            name: "Test Space",
            code: MOCK_USER.space_code,
            is_organization: false,
          },
        ],
        current_space: {
          id: "space-narrative-1",
          name: "Test Space",
          code: MOCK_USER.space_code,
          currency: "PHP",
        },
      }),
    });
  });

  await page.route("**/api/v1/dashboard*", async (route) => {
    const dashboardPayload = buildDashboardApiJson({ monthlyExpenses: 0 });
    dashboardPayload.data.dashboard.expenseCategoryOptions = [
      {
        id: PARENT_ID,
        name: "Subscriptions & Hobbies",
        label: "Subscriptions & Hobbies",
        parentId: null,
        children: [],
      },
    ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboardPayload),
    });
  });

  await page.route("**/api/v1/insights**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const section = url.pathname.split("/").pop() || "insights";

    const narratives = {
      headline: { text: "You kept ₱1 this period.", sentiment: "positive" },
      metrics: [],
      insights: [
        {
          type: "category_trend",
          severity: "warning",
          title: "Subscriptions & Hobbies spending up",
          body: "Subscriptions & Hobbies is 37.14% higher than the prior period.",
          actionLabel: "Filter transactions",
          actionHref: "/dashboard?category=Subscriptions+%26+Hobbies",
        },
      ],
      dataQuality: {
        transactionCount: 10,
        categorizedPercent: "90%",
        completenessTier: "complete",
      },
    };

    let data: unknown = narratives;
    if (section === "narratives") {
      data = narratives;
    } else if (section === "summary") {
      data = { total_income: "100", total_expenses: "50", net_savings: "50" };
    } else if (section === "health_scores") {
      data = {
        savings_percentage: { percentage: "50%", score: 100 },
        debt_to_income_ratio: {
          percentage: "0%",
          score: 100,
          monthly_debt: "0",
        },
        budget_usage: { percentage: "0%", score: 100 },
        financial_health_score: "100%",
      };
    } else if (section === "expense_breakdown") {
      data = [];
    } else if (section === "weekly_spending") {
      data = [];
    } else if (section === "monthly_spending") {
      data = [];
    } else if (section === "account_breakdown") {
      data = { total_balance: "0", breakdown: [] };
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

    const requestUrl = new URL(route.request().url());
    const categoryId = requestUrl.searchParams.get("categoryId");
    const categoryName = requestUrl.searchParams.get("categoryName");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          transactions: [],
          pagination: { page: 1, limit: 50, totalPages: 1, totalCount: 0 },
          totals: null,
          _categoryId: categoryId,
          _categoryName: categoryName,
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
        JSON.stringify({ sub: "user123", email: "test@example.com", name: "Test User" }),
      );
      localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope);
      localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString());
      localStorage.setItem(
        "fintr_auth_data",
        JSON.stringify({
          tokens: mockTokens,
          user: { sub: "user123", email: "test@example.com", name: "Test User" },
        }),
      );
      localStorage.setItem("spaceCode", "TEST-SPACE-NARRATIVE-FILTER");
      localStorage.setItem("fintr_weekly_feedback_v1_lastActionAt", String(Date.now()));
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", weekKey);
    },
    { domain, mockTokens, expiresAt, weekKey },
  );
}

test.describe("Insights narrative category filter link", () => {
  test.describe.configure({ timeout: 60_000 });

  test("category spike card links to transactions with encoded category param", async ({
    page,
  }) => {
    await mockInsightsWithCategorySpike(page);
    await setupAuth(page);

    await page.goto("/dashboard/insights", { waitUntil: "domcontentloaded" });

    const insightTitle = page.getByText("Subscriptions & Hobbies spending up");
    await insightTitle.scrollIntoViewIfNeeded();
    await expect(insightTitle).toBeVisible({ timeout: 30_000 });

    const link = page.getByRole("link", { name: "Filter transactions" });
    await expect(link).toHaveAttribute(
      "href",
      "/dashboard?category=Subscriptions+%26+Hobbies",
    );
  });

  test("dashboard reads category query param when loading transactions", async ({
    page,
  }) => {
    await mockInsightsWithCategorySpike(page);
    await setupAuth(page);

    let filteredTransactionsUrl = "";

    await page.route("**/api/v1/transactions**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      const requestUrl = route.request().url();
      if (!requestUrl.includes("/categories")) {
        const url = new URL(requestUrl);
        if (
          url.searchParams.get("categoryId") === PARENT_ID
          || url.searchParams.get("categoryName") === "Subscriptions & Hobbies"
        ) {
          filteredTransactionsUrl = requestUrl;
        }
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

    await page.goto(
      "/dashboard?category=Subscriptions%20%26%20Hobbies",
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByText("All Transactions")).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(() => filteredTransactionsUrl, { timeout: 15_000 })
      .toContain("categoryId=");
  });
});
