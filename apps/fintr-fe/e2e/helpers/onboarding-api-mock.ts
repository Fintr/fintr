import type { Page } from "@playwright/test"
import { routeDashboardApi } from "./dashboard-api-mock"

export type OnboardingStepMock =
  | "currency"
  | "income"
  | "budgets"
  | "accounts"
  | "import"
  | "completed"
  | ""

type RouteOnboardingApiOptions = {
  onboardingStep?: OnboardingStepMock
  spaceCode?: string
  isAdmin?: boolean
}

export async function routeOnboardingApi(
  page: Page,
  options: RouteOnboardingApiOptions = {},
) {
  const {
    onboardingStep = "completed",
    spaceCode = "test-space",
    isAdmin = false,
  } = options

  await page.route("**/api/v1/auth/private", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          spaceCode,
          isAdmin,
          onboardingStep,
          desktopTutorial: true,
          mobileTutorial: true,
        },
      }),
    })
  })

  await page.route("**/api/v1/spaces/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [{ id: "space-1", name: "Test Space", is_organization: false }],
        current_space: { id: "space-1", name: "Test Space" },
      }),
    })
  })

  await routeDashboardApi(page)
}
