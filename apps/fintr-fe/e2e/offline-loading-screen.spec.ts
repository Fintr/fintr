import { test, expect, type Page } from "@playwright/test";

import { mockOfflineNavigationApi } from "./helpers/mock-offline-navigation-api";
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed";
import { primeOfflineSyncReady } from "./helpers/prime-offline-sync-ready";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const SPACE_CODE = "test-space";

async function waitForDashboardShell(page: Page) {
  const loadingScreen = page.getByTestId("app-loading-screen");
  const offlineSyncScreen = page.getByTestId("offline-sync-screen");

  await expect(offlineSyncScreen.or(loadingScreen)).toBeHidden({
    timeout: 60000,
  });

  await expect(page.getByTestId("mobile-nav-transactions")).toBeVisible({
    timeout: 30000,
  });
}

async function assertNoFullScreenSplash(page: Page) {
  await expect(page.getByTestId("app-loading-screen")).toBeHidden({
    timeout: 5000,
  });
  await expect(page.getByTestId("offline-sync-screen")).toBeHidden({
    timeout: 5000,
  });
}

async function installSplashCounter(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __fintrSplashCount: number }).__fintrSplashCount = 0;

    const countVisibleSplash = () => {
      const selectors = [
        '[data-testid="app-loading-screen"]',
        '[data-testid="offline-sync-screen"]',
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (!element) {
          continue;
        }

        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          continue;
        }

        (window as unknown as { __fintrSplashCount: number }).__fintrSplashCount += 1;
      }
    };

    const observer = new MutationObserver(() => {
      countVisibleSplash();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });

    window.addEventListener("DOMContentLoaded", countVisibleSplash);
  });
}

async function readSplashCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __fintrSplashCount?: number }).__fintrSplashCount ?? 0,
  );
}

async function primeOfflineLoadingScreenTest(page: Page) {
  await mockOfflineNavigationApi(page, SPACE_CODE);
  await setAuthStorageForE2e(page, { spaceCode: SPACE_CODE });
  await primeOfflineSyncReady(page);
  await primeWeeklyFeedbackDismissed(page);
  await installSplashCounter(page);
}

test.describe("online navigation without full-screen splash", () => {
  test.describe.configure({ timeout: 120000 });

  test.use({
    viewport: { width: 393, height: 851 },
    serviceWorkers: "allow",
  });

  test.beforeEach(async ({ page }) => {
    await primeOfflineLoadingScreenTest(page);
  });

  test("bottom-nav clicks never show the Fintr loading splash", async ({ page }) => {
    await page.goto("/dashboard/home", { waitUntil: "domcontentloaded" });
    await waitForDashboardShell(page);

    const splashAfterBootstrap = await readSplashCount(page);

    const navClicks = [
      () => page.getByTestId("mobile-nav-transactions").click(),
      () => page.getByTestId("mobile-nav-dashboard").click(),
      () => page.getByTestId("mobile-nav-menu").click(),
      () => page.getByRole("link", { name: "Home" }).click(),
    ] as const;

    for (const clickNav of navClicks) {
      await clickNav();
      await assertNoFullScreenSplash(page);
    }

    const detailRoutes = [
      "/dashboard/space_settings/entities",
      "/dashboard/space_settings/entities/detail?entityId=entity-e2e-1",
      "/dashboard/transactions/detail?transactionId=test-tx",
      "/dashboard/space_settings/accounts/detail?accountId=test-account",
    ] as const;

    for (const path of detailRoutes) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await assertNoFullScreenSplash(page);
    }

    const splashAfterNavigation = await readSplashCount(page);
    expect(splashAfterNavigation).toBe(splashAfterBootstrap);
  });
});

test.describe("offline navigation without full-screen splash", () => {
  test.describe.configure({ timeout: 120000 });

  test.use({
    viewport: { width: 393, height: 851 },
    serviceWorkers: "allow",
  });

  test.beforeEach(async ({ page }) => {
    await primeOfflineLoadingScreenTest(page);
  });

  test("home → offline → entities → entity detail keeps the shell visible", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard/home", { waitUntil: "domcontentloaded" });
    await waitForDashboardShell(page);

    await page.goto("/dashboard/space_settings/entities", {
      waitUntil: "domcontentloaded",
    });
    await assertNoFullScreenSplash(page);

    await page.goto(
      "/dashboard/space_settings/entities/detail?entityId=entity-e2e-1",
      { waitUntil: "domcontentloaded" },
    );
    await assertNoFullScreenSplash(page);

    await page.goto("/dashboard/home", { waitUntil: "domcontentloaded" });
    await assertNoFullScreenSplash(page);

    await context.setOffline(true);

    await assertNoFullScreenSplash(page);

    await page.waitForTimeout(1000);
    await assertNoFullScreenSplash(page);
  });
});
