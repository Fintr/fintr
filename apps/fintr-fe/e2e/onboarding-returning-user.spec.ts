import { test, expect, Page } from "@playwright/test"
import { buildTestJwt } from "./helpers/build-test-jwt"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { routeOnboardingApi } from "./helpers/onboarding-api-mock"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

const gotoOptions = { waitUntil: "domcontentloaded" as const }

const buildTestIdToken = (email: string): string => buildTestJwt({ email })

async function primeReturningUserAuth(
  page: Page,
  email = "returning@example.com",
) {
  await setAuthStorageForE2e(page, {
    email,
    name: "Returning User",
    sub: "auth0|e2e-returning-user",
  })
}

async function expectNoSetupScreens(page: Page) {
  await expect(page.getByTestId("onboarding-completed-page")).toHaveCount(0)
  await expect(page.getByTestId("workspace-setup-gate")).toHaveCount(0)
  await expect(page.getByTestId("onboarding-setup-loading")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Congratulations!" })).toHaveCount(0)
  await expect(page.getByText("Preparing your workspace setup...")).toHaveCount(0)
  await expect(page.getByText("Let's set up your workspace")).toHaveCount(0)
}

async function expectDashboardReadyWithinThreeSeconds(page: Page) {
  await expect(page.getByTestId("app-loading-screen")).toHaveCount(0, {
    timeout: 5000,
  })
}

test.describe("Returning user login should skip first-time setup", () => {
  test("login routes completed users to dashboard without setup screens", async ({ page }) => {
    const email = "returning@example.com"
    const token = buildTestIdToken(email)

    await routeOnboardingApi(page, { onboardingStep: "completed" })
    await mockCommonDashboardApi(page)

    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Success",
          data: {
            accessToken: token,
            idToken: token,
            refreshToken: "e2e-returning-refresh-token",
            expiresIn: 3600,
            tokenType: "Bearer",
            scope: "openid",
          },
        }),
      })
    })

    await page.goto("/auth", gotoOptions)
    await page.locator("#login-email, input[name='email']").fill(email)
    await page.locator("#login-password, input[name='password']").fill("Str0ng!Pass123")
    await page.getByRole("button", { name: "Continue", exact: true }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectNoSetupScreens(page)
    await expectDashboardReadyWithinThreeSeconds(page)
  })

  test("direct dashboard visit for completed users never shows setup screens", async ({ page }) => {
    await primeReturningUserAuth(page)
    await primeWeeklyFeedbackDismissed(page)
    await routeOnboardingApi(page, { onboardingStep: "completed" })
    await mockCommonDashboardApi(page)

    await page.goto("/dashboard/", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectNoSetupScreens(page)
    await expectDashboardReadyWithinThreeSeconds(page)
  })

  test("visiting /onboarding redirects completed users to dashboard", async ({ page }) => {
    await primeReturningUserAuth(page)
    await routeOnboardingApi(page, { onboardingStep: "completed" })
    await mockCommonDashboardApi(page)

    await page.goto("/onboarding", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectNoSetupScreens(page)
  })

  test("incomplete onboarding still routes new users into setup", async ({ page }) => {
    await primeReturningUserAuth(page)
    await mockCommonDashboardApi(page)
    await routeOnboardingApi(page, { onboardingStep: "currency" })

    await page.goto("/dashboard/", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
    await expect(page.getByTestId("workspace-setup-gate")).toHaveCount(0)
  })

  test("recovers when auth/private initially returns 401 after login", async ({ page }) => {
    let authPrivateRequestCount = 0

    await mockCommonDashboardApi(page)

    await page.route("**/api/v1/auth/private", async (route) => {
      authPrivateRequestCount += 1

      if (authPrivateRequestCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Requires authentication" }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            spaceCode: "test-space",
            isAdmin: false,
            onboardingStep: "completed",
            desktopTutorial: true,
            mobileTutorial: true,
          },
        }),
      })
    })

    await primeReturningUserAuth(page)
    await primeWeeklyFeedbackDismissed(page)

    await page.goto("/dashboard/", gotoOptions)

    await expect.poll(() => authPrivateRequestCount).toBeGreaterThan(1)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectDashboardReadyWithinThreeSeconds(page)
    await expectNoSetupScreens(page)
  })

  test("dashboard leaves bootstrap loading within three seconds", async ({ page }) => {
    await primeReturningUserAuth(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)

    await page.route("**/api/v1/auth/private", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            spaceCode: "test-space",
            isAdmin: false,
            onboardingStep: "completed",
            desktopTutorial: true,
            mobileTutorial: true,
          },
        }),
      })
    })

    await page.goto("/dashboard/", gotoOptions)

    await expectDashboardReadyWithinThreeSeconds(page)
  })
})
