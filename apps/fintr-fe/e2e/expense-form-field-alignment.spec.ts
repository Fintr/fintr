import { test, expect, Page, Locator } from "@playwright/test"
import { auth0LocalStorageKeySuffix } from "./helpers/auth0-storage-suffix"
import { routeDashboardApi } from "./helpers/dashboard-api-mock"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"

/** Tailwind h-10 / min-h-10 (40px) — shared form control height */
const EXPECTED_CONTROL_HEIGHT_PX = 40
const HEIGHT_TOLERANCE_PX = 2
const TOP_ALIGN_TOLERANCE_PX = 1

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

async function openExpenseForm(page: Page) {
  await setAuthStorage(page)
  await primeWeeklyFeedbackDismissed(page)
  await mockApiCalls(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/dashboard/", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForLoadState("domcontentloaded")

  const addButton = page.locator('[data-tutorial-target="add-transaction-button"]')
  await expect(addButton).toBeVisible({ timeout: 15000 })
  await addButton.click()

  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10000,
  })
  await expect(page.locator("#scheduleType")).toBeVisible({ timeout: 10000 })
}

async function expectStandardControlHeight(
  locator: Locator,
  label: string,
) {
  const box = await locator.boundingBox()
  expect(box, `${label} should be visible`).not.toBeNull()

  const height = box!.height
  expect(
    height,
    `${label} height should be ~${EXPECTED_CONTROL_HEIGHT_PX}px (got ${height}px)`,
  ).toBeGreaterThanOrEqual(EXPECTED_CONTROL_HEIGHT_PX - HEIGHT_TOLERANCE_PX)
  expect(
    height,
    `${label} height should be ~${EXPECTED_CONTROL_HEIGHT_PX}px (got ${height}px)`,
  ).toBeLessThanOrEqual(EXPECTED_CONTROL_HEIGHT_PX + HEIGHT_TOLERANCE_PX)
}

async function expectAlignedTops(a: Locator, b: Locator, label: string) {
  const boxA = await a.boundingBox()
  const boxB = await b.boundingBox()
  expect(boxA, `${label}: first control visible`).not.toBeNull()
  expect(boxB, `${label}: second control visible`).not.toBeNull()

  const topDelta = Math.abs(boxA!.y - boxB!.y)
  expect(
    topDelta,
    `${label}: controls should share the same row baseline (Δy=${topDelta}px)`,
  ).toBeLessThanOrEqual(TOP_ALIGN_TOLERANCE_PX)
}

test.describe("Expense form field alignment", () => {
  test.describe.configure({ timeout: 60_000 })

  test("paired fields align on every row of the expense form", async ({ page }) => {
    await openExpenseForm(page)

    const dateButton = page
      .locator('label[for="date"]')
      .locator('xpath=ancestor::div[contains(@class,"grid-rows")]/div[contains(@class,"flex")]')
      .getByRole("button")
      .first()
    const amountInput = page.locator("#amount")
    const scheduleType = page.locator("#scheduleType")
    const categoryPicker = page.locator("#category")
    const accountPicker = page.locator("#accountName")
    const description = page.locator("#description")
    const form = page.locator("form").filter({ has: page.locator("#scheduleType") }).first()

    await expectAlignedTops(dateButton, amountInput, "Date / Amount")
    await expectAlignedTops(scheduleType, categoryPicker, "Schedule Type / Category")

    const formWidth = (await form.boundingBox())?.width ?? 0
    const noteWidth = (await description.boundingBox())?.width ?? 0
    expect(formWidth).toBeGreaterThan(0)
    expect(noteWidth).toBeGreaterThan(formWidth * 0.9)

    for (const [locator, name] of [
      [dateButton, "Date"],
      [amountInput, "Amount"],
      [scheduleType, "Schedule Type"],
      [categoryPicker, "Category"],
      [accountPicker, "Account"],
    ] as const) {
      await expectStandardControlHeight(locator, name)
    }
  })
})
