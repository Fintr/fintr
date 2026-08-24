import { test, expect, Page } from "@playwright/test";
import { buildDashboardApiJson } from "./helpers/dashboard-api-mock";
import { mockCommonDashboardApi } from "./helpers/mock-common-api";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const MOCK_USER = {
  space_code: "TEST-SPACE-INSTALL-FX",
};

const STORED_RATE = 100;
const AUTO_RATE = 82.952;

type InstallmentPayment = {
  id: string;
  date: string;
  description: string;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  installmentTotal: number;
  installmentPeriod: number;
  parentId: string;
};

function buildInstallmentDetail(payment: InstallmentPayment) {
  return {
    id: payment.id,
    amount: payment.convertedAmount,
    amountCurrency: "PHP",
    bookedAmount: payment.originalAmount,
    bookedAmountCurrency: payment.originalCurrency,
    originalDisplayAmount: payment.originalAmount,
    originalDisplayCurrency: payment.originalCurrency,
    description: payment.description,
    categoryName: "Home",
    accountName: "GCash",
    transactionDate: payment.date,
    date: payment.date,
    scheduleType: "installment",
    repeatInterval: "P1M",
    installmentPeriod: payment.installmentPeriod,
    installmentTotal: payment.installmentTotal,
    transactionType: "expense",
    type: "expense",
    hasCurrencyConversion: true,
    currencyConversion: {
      originalAmount: payment.originalAmount,
      originalCurrency: payment.originalCurrency,
      convertedAmount: payment.convertedAmount,
      convertedCurrency: "PHP",
      exchangeRate: STORED_RATE,
      source: "recent",
    },
  };
}

function buildInstallmentIndexRow(
  payment: InstallmentPayment,
  options?: { omitBookedLeg?: boolean },
) {
  return {
    id: payment.id,
    date: payment.date,
    description: payment.description,
    amount: payment.convertedAmount,
    amountCurrency: "PHP",
    ...(options?.omitBookedLeg
      ? {}
      : {
          bookedAmount: payment.originalAmount,
          bookedAmountCurrency: payment.originalCurrency,
        }),
    categoryName: "Home",
    fromAccountName: "GCash",
    toAccountName: "",
    type: "expense",
    inSeries: true,
    parentId: payment.parentId,
    rootParentId: payment.parentId,
    scheduleType: "installment",
    repeatInterval: "P1M",
    installmentPeriod: payment.installmentPeriod,
    installmentTotal: payment.installmentTotal,
    hasImage: false,
  };
}

async function mockInstallmentStoredRateEditFlow(
  page: Page,
  payment: InstallmentPayment,
  options?: {
    omitBookedLegOnList?: boolean;
    omitCurrencyConversionOnDetail?: boolean;
  },
) {
  const dashboard = buildDashboardApiJson({ monthlyExpenses: 0 });
  dashboard.data.dashboard.accountOptions = [
    { label: "GCash", value: "GCash", currency: "PHP" },
  ];
  dashboard.data.dashboard.expenseCategoryOptions = [
    {
      id: "cat-home",
      label: "Home",
      value: "cat-home",
      name: "Home",
      parentId: null,
      children: [],
    },
  ];

  await mockCommonDashboardApi(page, { monthlyExpenses: 0 });

  await page.route("**/api/v1/entities**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [],
      }),
    });
  });

  await page.route("**/api/v1/dashboard*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboard),
    });
  });

  await page.route("**/api/v1/exchange_rates/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/current")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            rate: AUTO_RATE,
            from_currency: url.searchParams.get("from_currency"),
            to_currency: url.searchParams.get("to_currency"),
            source: "api",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          rates: [{ rate: AUTO_RATE, usedAt: "2026-07-19T00:00:00.000Z" }],
          source: "recent",
        },
      }),
    });
  });

  await page.route("**/api/v1/transactions**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    const detailMatch = pathname.match(/\/transactions\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const detail = buildInstallmentDetail(payment);
      if (options?.omitCurrencyConversionOnDetail) {
        delete (detail as { currencyConversion?: unknown }).currencyConversion;
        delete (detail as { hasCurrencyConversion?: boolean }).hasCurrencyConversion;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data:
            detailMatch[1] === payment.id
              ? detail
              : null,
        }),
      });
      return;
    }

    if (method === "GET" && pathname.endsWith("/transactions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            transactions: [
              buildInstallmentIndexRow(payment, {
                omitBookedLeg: options?.omitBookedLegOnList,
              }),
            ],
            pagination: {
              page: 1,
              limit: 50,
              totalPages: 1,
              totalCount: 1,
            },
            totals: null,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

async function setupAuth(page: Page) {
  await setAuthStorageForE2e(page, { spaceCode: MOCK_USER.space_code });
  await primeWeeklyFeedbackDismissed(page);
}

async function openInstallmentEditDialog(page: Page, description: string) {
  await page.getByText(description).first().click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`${description} · GBP`, "i") }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Total amount" })).toBeVisible({
    timeout: 15_000,
  });
}

async function expectStoredRateVisible(page: Page) {
  const rateQuote = page.locator("p").filter({ hasText: "PHP per 1 GBP" }).first();
  await expect(rateQuote).toBeVisible({ timeout: 15_000 });
  await expect(rateQuote).toContainText("100");
  await expect(rateQuote).not.toContainText("82");
}

async function expectPlanTotalInGbp(page: Page) {
  await expect(page.getByRole("textbox", { name: "Total amount" })).toHaveValue(
    "2,400",
  );
}

test.describe("Installment edit stored exchange rate", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 1280, height: 900 } });

  const payment: InstallmentPayment = {
    id: "tx-install7-dec",
    date: "2027-12-01",
    description: "INSTALL7",
    originalAmount: 100,
    originalCurrency: "GBP",
    convertedAmount: 10_000,
    installmentTotal: 240_000,
    installmentPeriod: 24,
    parentId: "tx-install7-root",
  };

  test("shows the persisted 100 PHP/GBP rate instead of today's auto rate", async ({
    page,
  }) => {
    await mockInstallmentStoredRateEditFlow(page, payment, {
      omitBookedLegOnList: true,
    });
    await setupAuth(page);
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" });

    await openInstallmentEditDialog(page, payment.description);
    await expectPlanTotalInGbp(page);
    await expectStoredRateVisible(page);

    await page.getByRole("button", { name: "Exchange rate options" }).click();
    const rateSheet = page.getByRole("dialog").last();
    await expect(rateSheet.getByText("Today's rate")).toBeVisible();
    const todayRow = rateSheet.locator("li").filter({ hasText: "Today's rate" });
    await expect(todayRow).toBeVisible();
    await expect(todayRow.locator("svg.lucide-check")).toHaveCount(0);
    await expect(rateSheet.getByText(/100(?:\.0+)?\s+PHP per 1 GBP/i)).toBeVisible();
  });

  test("keeps the stored rate when the list row already includes booked legs", async ({
    page,
  }) => {
    await mockInstallmentStoredRateEditFlow(page, payment);
    await setupAuth(page);
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" });

    await openInstallmentEditDialog(page, payment.description);
    await expectPlanTotalInGbp(page);
    await expectStoredRateVisible(page);
    await expect(page.getByLabel("This payment only")).toHaveValue("100");
  });

  test("infers the stored rate when detail omits currencyConversion but keeps original display", async ({
    page,
  }) => {
    await mockInstallmentStoredRateEditFlow(page, payment, {
      omitBookedLegOnList: true,
      omitCurrencyConversionOnDetail: true,
    });
    await setupAuth(page);
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" });

    await openInstallmentEditDialog(page, payment.description);
    await expectPlanTotalInGbp(page);
    await expectStoredRateVisible(page);
  });
});
