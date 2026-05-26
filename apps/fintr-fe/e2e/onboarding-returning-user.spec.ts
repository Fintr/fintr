import { test, expect, Page } from "@playwright/test"
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix"
import { routeOnboardingApi } from "./helpers/onboarding-api-mock"
import { routeDashboardApi } from "./helpers/dashboard-api-mock"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"

const gotoOptions = { waitUntil: "domcontentloaded" as const }

const buildTestIdToken = (email: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ sub: "auth0|e2e-user", email, name: "E2E User" }),
  ).toString("base64url")
  return `${header}.${payload}.e2e-signature`
}

async function setAuthStorage(page: Page, email = "returning@example.com") {
  const domainSuffix = auth0LocalStorageKeySuffix()
  await page.addInitScript(
    ([domain, userEmail]) => {
      const mockUser = {
        sub: "auth0|e2e-returning-user",
        email: userEmail,
        name: "Returning User",
      }
      const mockTokens = {
        access_token: "e2e-returning-access-token",
        id_token: "e2e-returning-id-token",
        refresh_token: "e2e-returning-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid profile email",
      }
      const expiresAt = Date.now() + 3600000

      localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token)
      localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token)
      localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token)
      localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString())
      localStorage.setItem(`@@auth0@@.user.${domain}`, JSON.stringify(mockUser))
      localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope)
      localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString())
      localStorage.setItem(
        "fintr_auth_data",
        JSON.stringify({ tokens: mockTokens, user: mockUser }),
      )
      localStorage.setItem("spaceCode", "test-space")
    },
    [domainSuffix, email] as const,
  )
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
    timeout: 3000,
  })
}

test.describe("Returning user login should skip first-time setup", () => {
  test("login routes completed users to dashboard without setup screens", async ({ page }) => {
    const email = "returning@example.com"

    await routeOnboardingApi(page, { onboardingStep: "completed" })

    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Success",
          data: {
            accessToken: "e2e-returning-access-token",
            idToken: buildTestIdToken(email),
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
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)
    await routeOnboardingApi(page, { onboardingStep: "completed" })

    await page.goto("/dashboard/", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectNoSetupScreens(page)
    await expectDashboardReadyWithinThreeSeconds(page)
  })

  test("visiting /onboarding redirects completed users to dashboard", async ({ page }) => {
    await setAuthStorage(page)
    await routeOnboardingApi(page, { onboardingStep: "completed" })

    await page.goto("/onboarding", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectNoSetupScreens(page)
  })

  test("incomplete onboarding still routes new users into setup", async ({ page }) => {
    await setAuthStorage(page)
    await routeOnboardingApi(page, { onboardingStep: "currency" })

    await page.goto("/dashboard/", gotoOptions)
    await page.waitForLoadState("domcontentloaded")

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
    await expect(page.getByTestId("workspace-setup-gate")).toHaveCount(0)
  })

  test("recovers when auth/private initially returns 401 after login", async ({ page }) => {
    let authPrivateRequestCount = 0

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

    await routeDashboardApi(page)
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)

    await page.goto("/dashboard/", gotoOptions)

    await expect.poll(() => authPrivateRequestCount).toBeGreaterThan(1)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expectDashboardReadyWithinThreeSeconds(page)
    await expectNoSetupScreens(page)
  })

  test("dashboard leaves bootstrap loading within three seconds", async ({ page }) => {
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)

    await page.route("**/api/v1/auth/private", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
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

    await routeDashboardApi(page)

    await page.goto("/dashboard/", gotoOptions)

    await expectDashboardReadyWithinThreeSeconds(page)
  })
})
