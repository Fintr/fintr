import { test, expect, Page } from "@playwright/test";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

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
  await setAuthStorageForE2e(page, {
    spaceCode: "TEST-SPACE-NARRATIVE-FILTER",
  })
  await primeWeeklyFeedbackDismissed(page)
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
      if (
        !requestUrl.includes("/categories")
        && requestUrl.includes(PARENT_ID)
      ) {
        filteredTransactionsUrl = requestUrl;
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

    const filteredTransactionsResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET"
        && response.url().includes("/api/v1/transactions")
        && !response.url().includes("/categories")
        && response.url().includes(PARENT_ID),
      { timeout: 30_000 },
    );

    await page.goto(
      "/dashboard?category=Subscriptions%20%26%20Hobbies",
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByRole("tabpanel", { name: "Transactions" })).toBeVisible({
      timeout: 30_000,
    });

    await filteredTransactionsResponse;

    await expect
      .poll(() => filteredTransactionsUrl, { timeout: 5_000 })
      .toContain(PARENT_ID);
  });
});
