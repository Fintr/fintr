import type { Page } from "@playwright/test"

import {
  routeDashboardApi,
  type DashboardMockOverrides,
} from "./dashboard-api-mock"

const emptyListResponse = {
  status: 200 as const,
  contentType: "application/json",
  body: JSON.stringify({ success: true, data: [] }),
}

export async function mockCommonDashboardApi(
  page: Page,
  overrides?: DashboardMockOverrides,
): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  await page.route("**/api/v1/auth/private", async (route) => {
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

  await page.route("**/api/v1/spaces**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        spaces: [{ id: "space-1", name: "Test Space", is_organization: false }],
        current_space: { id: "space-1", name: "Test Space" },
      }),
    })
  })

  await routeDashboardApi(page, overrides)

  await page.route("**/api/v1/transactions**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          transactions: [],
          pagination: { page: 1, limit: 50, totalPages: 1, totalCount: 0 },
          totals: null,
        },
      }),
    })
  })

  await page.route("**/api/v1/transactions/accounts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: "acc1", name: "Cash", currency: "PHP", type: "cash" }],
      }),
    })
  })

  await page.route("**/api/v1/conversations**", async (route) => {
    await route.fulfill(emptyListResponse)
  })

  await page.route("**/api/v1/ai**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { usage: 0, limit: 100 },
      }),
    })
  })

  await page.route("**/api/v1/cache_version", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { cacheVersion: "e2e", updatedAt: null },
      }),
    })
  })

  await page.route("**/api/v1/product_pulse**", async (route) => {
    await route.fulfill(emptyListResponse)
  })
}
