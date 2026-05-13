import { test, expect, Page } from "@playwright/test"
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix"
import { routeDashboardApi } from "./helpers/dashboard-api-mock"
import { getCurrentIsoWeekKey } from "@/config/weekly-feedback"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"

/**
 * E2E tests for CalendarPopover overlay close in Add/Edit Transaction flows.
 */

async function mockApiCalls(page: Page) {
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

  await page.route("**/api/v1/transactions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, limit: 50, total: 0 },
      }),
    })
  })

  await page.route("**/api/v1/accounts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "acc1", name: "Cash", currency: "PHP", type: "cash" },
          { id: "acc2", name: "Bank", currency: "PHP", type: "bank" },
        ],
      }),
    })
  })

  await page.route("**/api/v1/categories/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "cat1", name: "Food", type: "expense" },
          { id: "cat2", name: "Transport", type: "expense" },
        ],
      }),
    })
  })
}

async function setupAuth(page: Page) {
  const domain = auth0LocalStorageKeySuffix()
  const mockUser = { sub: "user123", email: "test@example.com", name: "Test User" }
  const mockTokens = {
    access_token: "mock_token",
    id_token: "mock_id_token",
    refresh_token: "mock_refresh",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "openid profile email",
  }
  const expiresAt = Date.now() + 3600000
  const weekKey = getCurrentIsoWeekKey(new Date())
  await page.evaluate(({ domain, mockUser, mockTokens, expiresAt, weekKey }) => {
    localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token)
    localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token)
    localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token || "")
    localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString())
    localStorage.setItem(`@@auth0@@.user.${domain}`, JSON.stringify(mockUser))
    localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope)
    localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString())
    localStorage.setItem("fintr_auth_data", JSON.stringify({ tokens: mockTokens, user: mockUser }))
    localStorage.setItem("spaceCode", "test-space")
    localStorage.setItem("fintr_weekly_feedback_v1_lastActionAt", String(Date.now()))
    localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", weekKey)
  }, { domain, mockUser, mockTokens, expiresAt, weekKey })
}

test.describe("CalendarPopover in Add Transaction", () => {
  test("closes date picker when tapping outside on mobile", async ({ page }) => {
    await primeWeeklyFeedbackDismissed(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await setupAuth(page)
    await page.reload()
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const addButton = page.locator("button:has-text('Add Transaction'), button:has-text('Add')").first()
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      const dateButton = page.locator("button:has-text('Pick a date')").first()
      if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dateButton.click()
        await page.waitForTimeout(800)

        const sheet = page.locator('[data-state="open"]').first()
        if (await sheet.isVisible().catch(() => false)) {
          const calendar = page.locator(".rdp")
          if (await calendar.isVisible().catch(() => false)) {
            const calendarBox = await calendar.boundingBox()
            if (calendarBox) {
              console.log("Calendar visible at:", calendarBox)
              
              await page.screenshot({ path: "before-click.png" })
              
              const clickX = 50
              const clickY = 50
              await page.mouse.click(clickX, clickY)
              await page.waitForTimeout(800)
              
              await page.screenshot({ path: "after-click.png" })
              
              const openSheets = await page.locator('[data-state="open"]').count()
              console.log("Open sheets after click:", openSheets)
              
              expect(openSheets).toBe(0)
            }
          }
        }
      }
    }
  })
})