import { test, expect } from "@playwright/test";
import {
  parseApiErrorMessage,
  parseAuthTokenPayload,
} from "../src/services/auth/parse-auth-response";
import { buildTestJwt } from "./helpers/build-test-jwt";
import { mockCommonDashboardApi } from "./helpers/mock-common-api";
import { setAuthStorageForE2e } from "./helpers/set-auth-storage";

const buildTestIdToken = (email: string): string => buildTestJwt({ email });

test.describe("Username/password auth API contract", () => {
  test("parseAuthTokenPayload reads direct camelCase token data", () => {
    const tokens = parseAuthTokenPayload({
      success: true,
      message: "Success",
      data: {
        accessToken: "access-token",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
        tokenType: "Bearer",
        scope: "openid",
      },
    });

    expect(tokens.access_token).toBe("access-token");
    expect(tokens.id_token).toBe("id-token");
    expect(tokens.expires_in).toBe(3600);
  });

  test("parseApiErrorMessage reads nested error.message from login failures", () => {
    const message = parseApiErrorMessage({
      success: false,
      error: {
        message: "Invalid credentials",
      },
    });

    expect(message).toBe("Invalid credentials");
  });

  test("parseApiErrorMessage prefers details when message is generic", () => {
    const message = parseApiErrorMessage({
      success: false,
      error: {
        message: "Registration failed",
        details: "Password is too weak",
      },
    });

    expect(message).toBe("Password is too weak");
  });

  test("parseAuthTokenPayload reads legacy nested value payloads", () => {
    const tokens = parseAuthTokenPayload({
      success: true,
      message: "Success",
      data: {
        value: {
          accessToken: "legacy-access",
          idToken: "legacy-id",
          expiresIn: 7200,
          tokenType: "Bearer",
          scope: "openid",
        },
      },
    });

    expect(tokens.access_token).toBe("legacy-access");
    expect(tokens.id_token).toBe("legacy-id");
    expect(tokens.expires_in).toBe(7200);
  });

  test("login UI shows Invalid credentials instead of [object Object]", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            message: "Invalid credentials",
          },
        }),
      });
    });

    await page.goto("/auth");

    await page.locator("#login-email, input[name='email']").fill("wrong@example.com");
    await page.locator("#login-password, input[name='password']").fill("wrong-password");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page.getByText("[object Object]")).toHaveCount(0);
  });

  test("signup shows weak password error in form without leaving signup view", async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    let signupRequestCount = 0;

    await page.route("**/api/v1/auth/signup", async (route) => {
      signupRequestCount += 1;
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            message: "Registration failed",
            details: "Password is too weak",
          },
        }),
      });
    });

    await page.goto("/auth");
    await page.getByRole("tab", { name: "Sign Up" }).click();
    await expect(page.locator("#register-first-name")).toBeVisible();

    await page.locator("#register-first-name").fill("E2E");
    await page.locator("#register-last-name").fill("User");
    await page.locator("#register-email").fill(uniqueEmail);
    await page.locator("#register-password").fill("password123");
    await page.locator("#register-confirm-password").fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect.poll(() => signupRequestCount).toBe(1);

    await expect(page.getByTestId("register-form-error")).toHaveText(
      "Password is too weak",
    );
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
    await expect(page.locator("#register-email")).toHaveValue(uniqueEmail);
    await expect(page.getByText("Create your account to get started")).toBeVisible();
  });

  test("signup stores tokens and routes to dashboard when signup returns tokens", async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    let signupRequestCount = 0;

    await mockCommonDashboardApi(page);

    await page.route("**/api/v1/auth/signup", async (route) => {
      signupRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Account created successfully",
          data: {
            accessToken: buildTestIdToken(uniqueEmail),
            idToken: buildTestIdToken(uniqueEmail),
            refreshToken: "e2e-refresh-token",
            expiresIn: 3600,
            tokenType: "Bearer",
            scope: "openid",
          },
        }),
      });
    });

    await page.goto("/auth");
    await page.getByRole("tab", { name: "Sign Up" }).click();

    await page.locator("#register-first-name").fill("E2E");
    await page.locator("#register-last-name").fill("User");
    await page.locator("#register-email").fill(uniqueEmail);
    await page.locator("#register-password").fill("Str0ng!Pass123");
    await page.locator("#register-confirm-password").fill("Str0ng!Pass123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect.poll(() => signupRequestCount).toBe(1);

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const keys = Object.keys(localStorage);
          return keys.some(
            (key) =>
              key.includes("access_token") &&
              localStorage.getItem(key)?.includes("e2e-signature"),
          );
        }),
      )
      .toBe(true);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
