import { test, expect } from "@playwright/test";

import { mockOfflineNavigationApi } from "./helpers/mock-offline-navigation-api";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const SPACE_CODE = "test-space";

async function waitForDashboardShell(page: import("@playwright/test").Page) {
  const loadingScreen = page.getByTestId("app-loading-screen");
  const offlineSyncScreen = page.getByTestId("offline-sync-screen");

  await expect(offlineSyncScreen.or(loadingScreen)).toBeHidden({
    timeout: 60000,
  });

  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible({
    timeout: 30000,
  });
}

async function primeOfflineNavigationTest(page: import("@playwright/test").Page) {
  await mockOfflineNavigationApi(page, SPACE_CODE);
  await setAuthStorageForE2e(page, { spaceCode: SPACE_CODE });
  await primeWeeklyFeedbackDismissed(page);
}

test.describe("mobile tab navigation (online)", () => {
  test.describe.configure({ timeout: 120000 });

  test.use({
    viewport: { width: 393, height: 851 },
    serviceWorkers: "block",
  });

  test.beforeEach(async ({ page }) => {
    await primeOfflineNavigationTest(page);
  });

  test("navigates between home, transactions, dashboard, and menu", async ({
    page,
  }) => {
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await waitForDashboardShell(page);

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/insights/);

    await page.getByRole("link", { name: "Menu" }).click();
    await expect(page).toHaveURL(/\/dashboard\/app_settings/);
    await expect(page.getByText("Space Management")).toBeVisible();

    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/dashboard\/home/);
  });
});

test.describe("mobile tab navigation (offline)", () => {
  test.describe.configure({ timeout: 120000 });

  test.use({
    viewport: { width: 393, height: 851 },
    serviceWorkers: "allow",
  });

  test.beforeEach(async ({ page }) => {
    await primeOfflineNavigationTest(page);
  });

  test("navigates after warming routes online, then goes offline", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard/home", { waitUntil: "domcontentloaded" });
    await waitForDashboardShell(page);

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/insights/);

    await page.getByRole("link", { name: "Menu" }).click();
    await expect(page).toHaveURL(/\/dashboard\/app_settings/);

    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/dashboard\/home/);

    await context.setOffline(true);

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/insights/);

    await page.getByRole("link", { name: "Menu" }).click();
    await expect(page).toHaveURL(/\/dashboard\/app_settings/);
    await expect(page.getByText("Space Management")).toBeVisible();
  });
});
