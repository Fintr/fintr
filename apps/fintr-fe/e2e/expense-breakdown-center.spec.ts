import { test, expect, Page } from "@playwright/test";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const MOCK_USER = {
  user_id: "e2e-expense-chart-user",
  email: "e2e-expense-chart@fintr.local",
  auth_id: "e2e-expense-chart-auth",
  space_code: "TEST-SPACE-EXPENSE-CHART",
};

const mockExpenseBreakdown = [
  {
    categoryName: "Subscriptions & Hobbies",
    amount: "36547.61",
    percentage: "26%",
  },
  {
    categoryName: "Shopping",
    amount: "28113.55",
    percentage: "20%",
  },
  {
    categoryName: "Home",
    amount: "18273.81",
    percentage: "13%",
  },
  {
    categoryName: "Transportation",
    amount: "15462.45",
    percentage: "11%",
  },
  {
    categoryName: "Dine Out & Entertainment",
    amount: "14056.77",
    percentage: "10%",
  },
  {
    categoryName: "Other",
    amount: "29513.55",
    percentage: "21%",
  },
];

async function mockInsightsWithExpenseBreakdown(page: Page) {
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
            id: "space-expense-chart-1",
            name: "Test Space",
            code: MOCK_USER.space_code,
            is_organization: false,
          },
        ],
        current_space: {
          id: "space-expense-chart-1",
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
      body: JSON.stringify(buildDashboardApiJson({ monthlyExpenses: 140_567.74 })),
    });
  });

  await page.route("**/api/v1/insights**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const section = url.pathname.split("/").pop() || "insights";

    const base = {
      summaryStructure: {
        totalIncome: "220804.55",
        totalExpenses: "140567.74",
        netSavings: "80236.81",
      },
      healthScores: {
        savingsPercentage: { percentage: "36%", score: 100 },
        debtToIncomeRatio: {
          percentage: "40%",
          score: 60,
          monthlyDebt: "1000",
        },
        budgetUsage: { percentage: "62%", score: 80 },
        financialHealthScore: "92%",
      },
      expenseBreakdown: mockExpenseBreakdown,
      weeklySpending: [],
      monthlySpending: [],
      accountBreakdown: {
        totalBalance: "5000",
        breakdown: [],
      },
    };

    let data: unknown = base;
    if (section === "summary") {
      data = base.summaryStructure;
    } else if (section === "health_scores") {
      data = base.healthScores;
    } else if (section === "expense_breakdown") {
      data = base.expenseBreakdown;
    } else if (section === "weekly_spending") {
      data = base.weeklySpending;
    } else if (section === "monthly_spending") {
      data = base.monthlySpending;
    } else if (section === "account_breakdown") {
      data = base.accountBreakdown;
    } else if (section === "narratives") {
      data = {
        headline: { text: "You kept ₱80,236.81 this period.", sentiment: "positive" },
        metrics: [],
        insights: [],
        dataQuality: {
          transactionCount: 10,
          categorizedPercent: "90%",
          completenessTier: "complete",
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
          transactions: [],
          pagination: { page: 1, limit: 50, totalPages: 1, totalCount: 0 },
        },
      }),
    });
  });
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, {
    spaceCode: "TEST-SPACE-EXPENSE-CHART",
  })
  await primeWeeklyFeedbackDismissed(page)
}

test.describe("Expense breakdown donut center label", () => {
  test.describe.configure({ timeout: 60_000 });

  test("Total Expenses label is centered in the donut hole", async ({ page }) => {
    await mockInsightsWithExpenseBreakdown(page);
    await setupAuth(page);

    await page.goto("/dashboard/insights", { waitUntil: "domcontentloaded" });

    const breakdownCard = page.getByTestId("expense-breakdown");
    await breakdownCard.scrollIntoViewIfNeeded();
    await expect(breakdownCard.getByText("Expense Breakdown")).toBeVisible({
      timeout: 30_000,
    });

    const chart = page.getByTestId("expense-breakdown-chart");
    await expect(chart).toBeVisible();

    await expect(chart.locator(".recharts-pie-sector").first()).toBeVisible({
      timeout: 15_000,
    });

    const centerLabel = chart.getByTestId("expense-breakdown-center");
    await expect(centerLabel).toBeVisible();
    await expect(centerLabel).toContainText("Total Expenses");

    const offsetPx = await chart.evaluate(() => {
      const chartEl = document.querySelector(
        '[data-testid="expense-breakdown-chart"]',
      );
      const labelEl = chartEl?.querySelector(
        '[data-testid="expense-breakdown-center"]',
      );
      const pieLayer = chartEl?.querySelector(".recharts-pie");
      const sectors = pieLayer?.querySelectorAll(".recharts-pie-sector");
      const tspans = labelEl?.querySelectorAll("tspan");

      if (!chartEl || !labelEl || !sectors?.length || !tspans?.length) {
        return null;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      sectors.forEach((sector) => {
        const rect = sector.getBoundingClientRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
      });

      const pieCenterX = (minX + maxX) / 2;
      const pieCenterY = (minY + maxY) / 2;

      let labelCenterX = 0;
      let labelCenterY = 0;
      tspans.forEach((tspan) => {
        const rect = tspan.getBoundingClientRect();
        labelCenterX += rect.left + rect.width / 2;
        labelCenterY += rect.top + rect.height / 2;
      });
      labelCenterX /= tspans.length;
      labelCenterY /= tspans.length;

      return {
        deltaX: Math.abs(pieCenterX - labelCenterX),
        deltaY: Math.abs(pieCenterY - labelCenterY),
      };
    });

    expect(offsetPx).not.toBeNull();
    expect(offsetPx!.deltaX).toBeLessThan(20);
    expect(offsetPx!.deltaY).toBeLessThan(20);
  });
});
