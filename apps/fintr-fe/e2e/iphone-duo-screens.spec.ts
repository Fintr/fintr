import { devices, expect, test, type Page } from "@playwright/test"

import { mockOfflineNavigationApi } from "./helpers/mock-offline-navigation-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

const SPACE_CODE = "test-space"

const IPHONE_DUO_VIEWPORTS = {
  folded: { width: 375, height: 812 },
  unfolded: { width: 690, height: 830 },
}

const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/login",
  "/signup",
  "/signup-success",
  "/account-setup",
  "/contact-us",
  "/delete-account",
  "/pricing",
  "/privacy-policy",
  "/terms-of-service",
  "/waitlist",
  "/whats-next",
]

const PRIVATE_ROUTES = [
  "/dashboard/",
  "/dashboard/home",
  "/dashboard/insights",
  "/dashboard/app_settings",
  "/dashboard/budgets",
  "/dashboard/goals",
  "/dashboard/investments",
  "/dashboard/loans",
  "/dashboard/loans/detail",
  "/dashboard/recurring",
  "/dashboard/recurring/detail",
  "/dashboard/settings",
  "/dashboard/subscriptions",
  "/dashboard/subscriptions/create",
  "/dashboard/transactions/detail",
  "/dashboard/space_settings",
  "/dashboard/space_settings/accounts",
  "/dashboard/space_settings/accounts/detail",
  "/dashboard/space_settings/categories",
  "/dashboard/space_settings/categories/detail",
  "/dashboard/space_settings/entities",
  "/dashboard/space_settings/entities/detail",
  "/dashboard/space_settings/import",
  "/dashboard/space_settings/subscriptions",
  "/dashboard/space_settings/tags",
  "/discover",
  "/consent",
  "/onboarding",
  "/onboarding/choice",
  "/onboarding/step1",
  "/onboarding/step2",
  "/onboarding/step3",
  "/onboarding/step4",
  "/onboarding/step5",
  "/onboarding/completed",
]

async function primePrivateSession(page: Page) {
  await mockOfflineNavigationApi(page, SPACE_CODE)
  await setAuthStorageForE2e(page, { spaceCode: SPACE_CODE })
  await primeWeeklyFeedbackDismissed(page)
}

async function waitForScreen(page: Page) {
  await expect(
    page
      .getByTestId("offline-sync-screen")
      .or(page.getByTestId("app-loading-screen")),
  ).toBeHidden({ timeout: 60000 })
  await page.waitForTimeout(1500)
}

for (const [fold, viewport] of Object.entries(IPHONE_DUO_VIEWPORTS)) {
  test.describe(`iPhone Duo ${fold}`, () => {
    test.describe.configure({ timeout: 120000 })

    const { userAgent, deviceScaleFactor, isMobile, hasTouch } =
      devices["iPhone 14"]

    test.use({
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      serviceWorkers: "block",
    })

    for (const route of [...PUBLIC_ROUTES, ...PRIVATE_ROUTES]) {
      test(`${fold} ${route}`, async ({ page }) => {
        if (PRIVATE_ROUTES.includes(route)) await primePrivateSession(page)

        await page.goto(route, { waitUntil: "domcontentloaded" })
        await waitForScreen(page)

        const slug = route.replace(/\//g, "_") || "_root"
        await page.screenshot({
          path: `test-results/iphone-duo/${fold}${slug}-viewport.png`,
        })
        await page.screenshot({
          path: `test-results/iphone-duo/${fold}${slug}.png`,
          fullPage: true,
        })

        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(horizontalOverflow).toBeLessThanOrEqual(0)
      })
    }
  })
}
