import { test, expect, Page } from "@playwright/test"
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix"
import { routeDashboardApi } from "./helpers/dashboard-api-mock"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"

/**
 * E2E tests for CalendarPopover overlay close behavior.
 * Tests that tapping outside the calendar (on blurred area) closes the date picker.
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
}

async function setAuthStorage(page: Page) {
  const domainSuffix = auth0LocalStorageKeySuffix()
  await page.addInitScript((domain) => {
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
    localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token)
    localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token)
    localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token || "")
    localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString())
    localStorage.setItem(`@@auth0@@.user.${domain}`, JSON.stringify(mockUser))
    localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope)
    localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString())
    localStorage.setItem("fintr_auth_data", JSON.stringify({ tokens: mockTokens, user: mockUser }))
    localStorage.setItem("spaceCode", "test-space")
  }, domainSuffix)
}

test.describe("CalendarPopover overlay dismiss", () => {
  test("closes when tapping overlay outside calendar", async ({ page }) => {
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const datePickButton = page.locator("button:has-text('Pick a date')").first()
    if (await datePickButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await datePickButton.click()
      await page.waitForTimeout(500)

      const sheet = page.locator('[data-state="open"]').first()
      const sheetVisible = await sheet.isVisible().catch(() => false)

      if (sheetVisible) {
        const calendar = page.locator(".rdp")
        if (await calendar.isVisible().catch(() => false)) {
          const calendarBox = await calendar.boundingBox()
          if (calendarBox) {
            const outsideX = 50
            const outsideY = 10
            await page.mouse.click(outsideX, outsideY)
            await page.waitForTimeout(500)

            const sheetStillOpen = await page.locator('[data-state="open"]').isVisible().catch(() => false)
            if (sheetStillOpen) {
              const openSheets = await page.locator('[data-state="open"]').count()
              console.log(`Sheet still open. Open sheets: ${openSheets}`)
            }
            expect(await page.locator('[data-state="open"]').count()).toBe(0)
          }
        }
      }
    }
  })

  test("calendar stays open when tapping inside calendar", async ({ page }) => {
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const datePickButton = page.locator("button:has-text('Pick a date')").first()
    if (await datePickButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await datePickButton.click()
      await page.waitForTimeout(500)

      const calendar = page.locator(".rdp")
      if (await calendar.isVisible().catch(() => false)) {
        const dayButton = page.locator(".rdp-button").nth(5)
        await dayButton.click()
        await page.waitForTimeout(300)

        const sheetStillOpen = await page.locator('[data-state="open"]').isVisible().catch(() => false)
        expect(sheetStillOpen).toBe(true)
      }
    }
  })
})