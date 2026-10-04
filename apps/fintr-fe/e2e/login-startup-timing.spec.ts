import { test, expect } from "@playwright/test";

import { buildTestJwt } from "./helpers/build-test-jwt";
import { mockCommonDashboardApi } from "./helpers/mock-common-api";

const TIMING_PROJECTS = new Set([
  "chromium",
  "Mobile Chrome - Small",
  "Mobile Safari - iPhone 14",
]);

const FORM_READY_BUDGET_MS = 8_000;
const SIGN_IN_BUDGET_MS = 8_000;
const NATIVE_HOME_BUDGET_MS = 8_000;

const NATIVE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp";

const loginTokenPayload = (email: string) => ({
  success: true,
  message: "Success",
  data: {
    accessToken: buildTestJwt({ email }),
    idToken: buildTestJwt({ email }),
    refreshToken: "e2e-refresh-token",
    expiresIn: 3600,
    tokenType: "Bearer",
    scope: "openid profile email",
  },
});

test.describe("login startup timing", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(({}, testInfo) => {
    test.skip(
      !TIMING_PROJECTS.has(testInfo.project.name),
      "Login timing runs on desktop, one Android viewport, and one iOS viewport",
    );
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/auth", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.close();
  });

  test("login form is ready shortly after opening the app", async ({ page }, testInfo) => {
    const startedAt = Date.now();

    await page.goto("/auth", { waitUntil: "commit" });
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();

    const formReadyMs = Date.now() - startedAt;
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;

      return {
        responseEndMs: entry ? Math.round(entry.responseEnd) : null,
        domContentLoadedMs: entry
          ? Math.round(entry.domContentLoadedEventEnd)
          : null,
      };
    });

    const timings = {
      project: testInfo.project.name,
      formReadyMs,
      ...navigation,
    };
    console.log(`[login-startup] ${JSON.stringify(timings)}`);
    testInfo.annotations.push({
      type: "login-form-ready-ms",
      description: String(formReadyMs),
    });

    expect(formReadyMs).toBeLessThan(FORM_READY_BUDGET_MS);
  });

  test("submitting credentials reaches home without a long wait", async ({ page }, testInfo) => {
    await mockCommonDashboardApi(page);
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(loginTokenPayload("login-timing@example.com")),
      });
    });

    await page.goto("/auth", { waitUntil: "commit" });
    await expect(page.locator("#login-email")).toBeVisible();

    await page.locator("#login-email").fill("login-timing@example.com");
    await page.locator("#login-password").fill("correct-password");
    await expect(page.locator("#login-email")).toHaveValue(
      "login-timing@example.com",
    );

    const startedAt = Date.now();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForURL(/\/dashboard\/home/, {
      waitUntil: "commit",
      timeout: 15_000,
    });
    const signInMs = Date.now() - startedAt;

    console.log(
      `[login-startup] ${JSON.stringify({
        project: testInfo.project.name,
        signInMs,
      })}`,
    );
    testInfo.annotations.push({
      type: "sign-in-ms",
      description: String(signInMs),
    });

    expect(signInMs).toBeLessThan(SIGN_IN_BUDGET_MS);
  });

  test("native shell home opens the login form instead of the marketing page", async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The native user-agent redirect is the same WebView script on every viewport",
    );

    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
      userAgent: NATIVE_USER_AGENT,
    });
    const page = await context.newPage();
    const startedAt = Date.now();

    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#login-email")).toBeVisible();

    const nativeHomeToLoginMs = Date.now() - startedAt;
    console.log(
      `[login-startup] ${JSON.stringify({
        project: testInfo.project.name,
        nativeHomeToLoginMs,
        url: page.url(),
      })}`,
    );
    testInfo.annotations.push({
      type: "native-home-to-login-ms",
      description: String(nativeHomeToLoginMs),
    });

    expect(page.url()).toContain("/auth");
    expect(nativeHomeToLoginMs).toBeLessThan(NATIVE_HOME_BUDGET_MS);

    await context.close();
  });
});
