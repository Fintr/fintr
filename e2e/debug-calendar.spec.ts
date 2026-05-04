import { test, expect, Page } from "@playwright/test"

/**
 * Debug test to see what's happening with calendar overlay close
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

test.describe("CalendarPopover debug", () => {
  test("debug calendar overlay click", async ({ page }) => {
    await setAuthStorage(page)
    await mockApiCalls(page)
    await page.goto("/dashboard/")
    await page.waitForLoadState("domcontentloaded")
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
          await page.screenshot({ path: "debug-calendar-open.png", fullPage: true })
          
          const calendar = page.locator(".rdp")
          const calendarBox = await calendar.boundingBox()
          console.log("Calendar bounding box:", calendarBox)
          
          if (calendarBox) {
            const overlayAboveCalendar = {
              x: 10,
              y: 10,
              width: 370,
              height: calendarBox.y - 20
            }
            console.log("Overlay area above calendar:", overlayAboveCalendar)
            
            await page.mouse.click(overlayAboveCalendar.x + overlayAboveCalendar.width / 2, overlayAboveCalendar.y + overlayAboveCalendar.height / 2)
            await page.waitForTimeout(500)
            
            await page.screenshot({ path: "debug-after-overlay-click.png", fullPage: true })
            
            const openSheets = await page.locator('[data-state="open"]').count()
            console.log("Open sheets after clicking above calendar:", openSheets)
          }
        }
      }
    }
  })
})