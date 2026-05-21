import { test, expect, Page } from "@playwright/test"
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix"
import { routeDashboardApi } from "./helpers/dashboard-api-mock"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"

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
        data: [{ id: "acc1", name: "Cash", currency: "PHP", type: "cash" }],
      }),
    })
  })

  await page.route("**/api/v1/categories/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: "cat1", name: "Food", type: "expense" }],
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

test.describe("Filter sheet", () => {
  test("opens transactions filter sheet with visible panel and controls", async ({
    page,
  }) => {
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)

    const filterButton = page.locator("button:has-text('Filters')").first()
    await expect(filterButton).toBeVisible({ timeout: 10000 })
    await filterButton.click()

    const dialog = page.getByRole("dialog", { name: "Transaction Filters" })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(
      dialog.getByRole("heading", { name: "Transaction Filters" }),
    ).toBeVisible()

    const customRange = dialog.getByRole("radio", { name: "Custom Range" })
    await expect(customRange).toBeVisible()

    const box = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)

    const overlay = page.locator(".fixed.inset-0.bg-black\\/40").first()
    await expect(overlay).toBeVisible()
  })

  test("closes filter sheet from Apply", async ({ page }) => {
    await setAuthStorage(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)

    const filterButton = page.locator("button:has-text('Filters')").first()
    await expect(filterButton).toBeVisible({ timeout: 10000 })
    await filterButton.click()

    const dialog = page.getByRole("dialog", { name: "Transaction Filters" })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByRole("button", { name: "Apply" }).click()
    await expect(dialog).toBeHidden({ timeout: 5000 })
  })
})
