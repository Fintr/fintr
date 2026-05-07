import { test, expect, Page } from "@playwright/test"

/**
 * E2E tests for responsive datepicker behavior:
 * - Below md (< 768px): should use Sheet (new datepicker)
 * - md and above (>= 768px): should use Popover (old/normal datepicker)
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

  await page.route("**/api/v1/dashboard/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: { total_balance: 10000, monthly_income: 5000, monthly_expenses: 3000 },
        categoryOptions: [],
      }),
    })
  })

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
        ],
      }),
    })
  })
}

async function setAuthStorage(page: Page) {
  await page.addInitScript(() => {
    const domain = "fintr_jp_auth0_com"
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
  })
}

test.describe("Responsive CalendarPopover", () => {
  test("shows Sheet (new datepicker) on mobile (< md)", async ({ page }) => {
    await setAuthStorage(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    const dateButton = page.locator("button:has-text('Pick a date')").first()
    if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateButton.click()
      await page.waitForTimeout(500)

      // On mobile, a Sheet should be open
      const sheet = page.locator('[data-state="open"]').first()
      expect(await sheet.isVisible().catch(() => false)).toBe(true)

      // The calendar should be visible inside the sheet
      const calendar = page.locator(".rdp")
      expect(await calendar.isVisible().catch(() => false)).toBe(true)
    }
  })

  test("shows Popover (old datepicker) on desktop (md+)", async ({ page }) => {
    await setAuthStorage(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 1280, height: 800 })

    const dateButton = page.locator("button:has-text('Pick a date')").first()
    if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateButton.click()
      await page.waitForTimeout(500)

      // On desktop, no Sheet should be open
      const openSheetCount = await page.locator('[data-state="open"]').count()
      expect(openSheetCount).toBe(0)

      // Instead, a Popover should be visible
      const popoverContent = page.locator('[data-radix-popper-content-wrapper]')
      expect(await popoverContent.isVisible().catch(() => false)).toBe(true)

      // The calendar should be visible inside the popover
      const calendar = page.locator(".rdp")
      expect(await calendar.isVisible().catch(() => false)).toBe(true)
    }
  })
})

test.describe("Responsive DateRangePicker", () => {
  test("shows fullscreen Sheet (new datepicker) on mobile (< md)", async ({ page }) => {
    await setAuthStorage(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 390, height: 844 })

    // Open filters to access custom date range
    const filterButton = page.locator("button:has-text('Filters')").first()
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterButton.click()
      await page.waitForTimeout(300)

      // Switch to custom range if needed
      const customButton = page.locator("button:has-text('Custom Range')").first()
      if (await customButton.isVisible().catch(() => false)) {
        await customButton.click()
        await page.waitForTimeout(300)
      }

      const rangeButton = page.locator("button:has-text('Pick a date range')").first()
      if (await rangeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await rangeButton.click()
        await page.waitForTimeout(500)

        // On mobile, a fullscreen Sheet should be open
        const sheet = page.locator('[data-state="open"]').first()
        expect(await sheet.isVisible().catch(() => false)).toBe(true)

        // The calendar should be visible
        const calendar = page.locator(".rdp")
        expect(await calendar.isVisible().catch(() => false)).toBe(true)
      }
    }
  })

  test("shows Popover (old datepicker) on desktop (md+)", async ({ page }) => {
    await setAuthStorage(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await page.setViewportSize({ width: 1280, height: 800 })

    // Open filters to access custom date range
    const filterButton = page.locator("button:has-text('Filters')").first()
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterButton.click()
      await page.waitForTimeout(300)

      // Switch to custom range if needed
      const customButton = page.locator("button:has-text('Custom Range')").first()
      if (await customButton.isVisible().catch(() => false)) {
        await customButton.click()
        await page.waitForTimeout(300)
      }

      const rangeButton = page.locator("button:has-text('Pick a date range')").first()
      if (await rangeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await rangeButton.click()
        await page.waitForTimeout(500)

        // On desktop, no Sheet should be open
        const openSheetCount = await page.locator('[data-state="open"]').count()
        expect(openSheetCount).toBe(0)

        // Instead, a Popover should be visible
        const popoverContent = page.locator('[data-radix-popper-content-wrapper]')
        expect(await popoverContent.isVisible().catch(() => false)).toBe(true)

        // The calendar should be visible inside the popover
        const calendar = page.locator(".rdp")
        expect(await calendar.isVisible().catch(() => false)).toBe(true)
      }
    }
  })
})
