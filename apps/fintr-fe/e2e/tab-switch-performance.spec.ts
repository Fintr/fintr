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

  // Bottom navigation should be present.
  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible({
    timeout: 30000,
  });
}

async function primeOfflineNavigationTest(page: import("@playwright/test").Page) {
  await mockOfflineNavigationApi(page, SPACE_CODE);
  await setAuthStorageForE2e(page, { spaceCode: SPACE_CODE });
  await primeWeeklyFeedbackDismissed(page);
}

type MeasureResult = {
  label: string;
  urlMs: number;
  contentMs: number;
};

async function measureTabSwitch(params: {
  page: import("@playwright/test").Page;
  label: string;
  clickName: string;
  destinationUrlRegex: RegExp;
  contentText: string | RegExp;
}): Promise<MeasureResult> {
  const { page, label, clickName, destinationUrlRegex, contentText } = params;

  const startMs = Date.now();
  await page.getByRole("link", { name: clickName }).click();

  await page.waitForURL(destinationUrlRegex);
  const urlMs = Date.now() - startMs;

  await expect(page.getByText(contentText)).toBeVisible({
    timeout: 30000,
  });
  const contentMs = Date.now() - startMs;

  // eslint-disable-next-line no-console
  console.log(`[tab-switch] ${label}: urlMs=${urlMs} contentMs=${contentMs}`);

  return { label, urlMs, contentMs };
}

test.describe("tab-switch performance baseline (web / Capacitor WebView behavior)", () => {
  test.describe.configure({ timeout: 120000 });

  test.use({
    viewport: { width: 393, height: 851 },
    serviceWorkers: "block",
  });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      // eslint-disable-next-line no-console
      console.log(`[playwright][console][${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.log(`[playwright][pageerror] ${err.message}`);
    });
    page.on("requestfailed", (req) => {
      const failure = req.failure();
      // eslint-disable-next-line no-console
      console.log(
        `[playwright][requestfailed] ${req.url()} ${failure?.errorText ?? ""}`,
      );
    });

    await primeOfflineNavigationTest(page);
  });

  test("Home → Transactions → Dashboard → Menu → Home", async ({ page }) => {
    await page.goto("/dashboard/", { waitUntil: "domcontentloaded" });
    // Matches the existing known-good mobile navigation e2e test which gives
    // the shell time to finish initial bootstrapping before we measure.
    await page.waitForTimeout(3000);

    const debug = await page.evaluate(() => {
      const appLoading = document.querySelector('[data-testid="app-loading-screen"]');
      const offlineSync = document.querySelector('[data-testid="offline-sync-screen"]');
      const style = (el: Element | null) => (el ? window.getComputedStyle(el as HTMLElement) : null);

      return {
        spaceCode: window.localStorage.getItem("spaceCode"),
        hasFintrAuthData: Boolean(window.localStorage.getItem("fintr_auth_data")),
        hasFintrE2eHooks: Boolean((window as any).__fintrE2e),
        hasEarlyErrors: Array.isArray((window as any).__earlyErrors),
        hasAppLoadingScreen: Boolean(appLoading),
        appLoadingDisplay: appLoading
          ? (style(appLoading)?.display ?? null)
          : null,
        auth0AccessKeys: Object.keys(window.localStorage).filter((k) =>
          k.startsWith("@@auth0@@.access_token."),
        ),
        auth0IdKeys: Object.keys(window.localStorage).filter((k) =>
          k.startsWith("@@auth0@@.id_token."),
        ),
        auth0UserKeys: Object.keys(window.localStorage).filter((k) =>
          k.startsWith("@@auth0@@.user."),
        ),
        auth0ExpiresKeys: Object.keys(window.localStorage).filter((k) =>
          k.startsWith("@@auth0@@.expires_at."),
        ),
        authDataSimulated: ["default", "fintr_jp_auth0_com"].map((domain) => {
          const accessToken = window.localStorage.getItem(
            `@@auth0@@.access_token.${domain}`,
          );
          const idToken = window.localStorage.getItem(
            `@@auth0@@.id_token.${domain}`,
          );
          const userStr = window.localStorage.getItem(
            `@@auth0@@.user.${domain}`,
          );
          const expiresAt = window.localStorage.getItem(
            `@@auth0@@.expires_at.${domain}`,
          );

          let parsedUserOk = false;
          try {
            if (userStr) {
              JSON.parse(userStr);
              parsedUserOk = true;
            }
          } catch {
            parsedUserOk = false;
          }

          const expiresOk = expiresAt ? Number.isFinite(parseInt(expiresAt, 10)) : false;

          return {
            domain,
            hasAllRequired:
              Boolean(accessToken && idToken && userStr && expiresAt) && parsedUserOk && expiresOk,
          };
        }),
        hasOfflineSyncScreen: Boolean(offlineSync),
        offlineSyncDisplay: offlineSync
          ? (style(offlineSync)?.display ?? null)
          : null,
      };
    });

    // eslint-disable-next-line no-console
    console.log("[tab-switch][debug]", debug);
    await waitForDashboardShell(page);

    const results: MeasureResult[] = [];
    results.push(
      await measureTabSwitch({
        page,
        label: "Transactions",
        clickName: "Transactions",
        destinationUrlRegex: /\/dashboard\/?$/,
        contentText: /Manage and filter your transaction history/i,
      }),
    );

    results.push(
      await measureTabSwitch({
        page,
        label: "Dashboard (Insights)",
        clickName: "Dashboard",
        destinationUrlRegex: /\/dashboard\/insights\/?$/,
        contentText: "Financial Health Score",
      }),
    );

    results.push(
      await measureTabSwitch({
        page,
        label: "Menu (App settings)",
        clickName: "Menu",
        destinationUrlRegex: /\/dashboard\/app_settings\/?$/,
        contentText: "Space Management",
      }),
    );

    results.push(
      await measureTabSwitch({
        page,
        label: "Home",
        clickName: "Home",
        destinationUrlRegex: /\/dashboard\/home\/?$/,
        contentText: /Recent transactions/i,
      }),
    );

    const worst = results.reduce((acc, r) => (r.contentMs > acc ? r.contentMs : acc), 0);
    console.log(
      `[tab-switch][summary] max contentMs=${worst}ms (avg=${Math.round(
        results.reduce((sum, r) => sum + r.contentMs, 0) / results.length,
      )}ms)`,
    );

    // No hard assertion yet: this is baseline measurement for the feasibility spike.
    expect(results.length).toBe(4);
  });
});

