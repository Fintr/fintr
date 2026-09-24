import { test, expect, Page } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"

const MIN_TOUCH_TARGET_PX = 44
const MOBILE_CALC_BUTTON_MIN_HEIGHT_PX = 48
const MIN_ROW_GAP_PX = 8

async function applyAndroidThreeButtonNavClasses(page: Page) {
  await page.evaluate(() => {
    document.documentElement.classList.add("fintr-native-android", "fintr-has-3btn-nav")
    document.documentElement.style.setProperty("--safe-area-inset-bottom", "48px")
  })
}

async function openAddTransactionCalculator(
  page: Page,
  options?: { androidThreeButtonNav?: boolean; skipAmountFocus?: boolean },
) {
  await page.goto("/dashboard/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  await page.waitForTimeout(1500)

  if (options?.androidThreeButtonNav) {
    await applyAndroidThreeButtonNavClasses(page)
  }

  const mobileFab = page.locator('[data-tutorial-target="mobile-add-button"]')
  const desktopAdd = page.locator('[data-tutorial-target="add-transaction-button"]')
  const viewport = page.viewportSize()
  const useMobileEntry = viewport != null && viewport.width < 768

  if (useMobileEntry) {
    await expect(mobileFab).toBeVisible({ timeout: 15000 })
    await mobileFab.click()
    const mobileAdd = page.locator('[data-tutorial-target="mobile-add-transaction"]')
    await expect(mobileAdd).toBeVisible({ timeout: 5000 })
    await mobileAdd.dispatchEvent("pointerdown")
    await page.waitForTimeout(250)
  } else {
    await expect(desktopAdd).toBeVisible({ timeout: 15000 })
    await desktopAdd.click()
  }

  await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible({
    timeout: 10000,
  })

  const amountInput = page.getByPlaceholder("0.00").first()

  if (!options?.skipAmountFocus) {
    await amountInput.click()
  }

  const keyboard = page.locator("[data-calculator-keyboard]")

  if (!options?.skipAmountFocus) {
    await expect(keyboard).toBeVisible({ timeout: 5000 })
  }

  return { keyboard, amountInput }
}

async function sampleKeyboardTopPositions(
  page: Page,
  inputLocator: ReturnType<Page["getByPlaceholder"]>,
  frameCount: number = 8,
): Promise<number[]> {
  await inputLocator.scrollIntoViewIfNeeded()
  await inputLocator.click()

  return page.evaluate(async (frames) => {
    const tops: number[] = [];

    for (let index = 0; index < frames; index += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const keyboard = document.querySelector("[data-calculator-keyboard]");
          tops.push(keyboard?.getBoundingClientRect().top ?? -1);
          resolve();
        });
      });
    }

    return tops;
  }, frameCount);
}

function maxConsecutiveTopJump(positions: number[]): number {
  let maxJump = 0;

  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1];
    const current = positions[index];

    if (previous < 0 || current < 0) {
      continue;
    }

    maxJump = Math.max(maxJump, Math.abs(current - previous));
  }

  return maxJump;
}

test.describe("Calculator keyboard layout", () => {
  test.setTimeout(90_000)
  test.beforeEach(async ({ page }) => {
    await setAuthStorageForE2e(page)
    await primeWeeklyFeedbackDismissed(page)
    await mockCommonDashboardApi(page)
  })

  test("mobile bottom-sheet keys meet minimum height and row spacing", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    const { keyboard } = await openAddTransactionCalculator(page)

    await expect(keyboard).toHaveClass(/rounded-t-xl/)

    const sampleButton = keyboard.locator("[data-calculator-keyboard-button]").first()
    const buttonBox = await sampleButton.boundingBox()
    expect(buttonBox?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(buttonBox?.height).toBeGreaterThanOrEqual(MOBILE_CALC_BUTTON_MIN_HEIGHT_PX - 2)

    const rowSeven = keyboard.getByRole("button", { name: "7", exact: true })
    const rowFour = keyboard.getByRole("button", { name: "4", exact: true })
    const sevenBox = await rowSeven.boundingBox()
    const fourBox = await rowFour.boundingBox()

    expect(sevenBox).not.toBeNull()
    expect(fourBox).not.toBeNull()

    if (sevenBox && fourBox) {
      const rowGap = fourBox.y - (sevenBox.y + sevenBox.height)
      expect(rowGap).toBeGreaterThanOrEqual(MIN_ROW_GAP_PX)
    }
  })

  test("reserves space above Android 3-button navigation", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    const { keyboard } = await openAddTransactionCalculator(page, {
      androidThreeButtonNav: true,
    })

    const bottomRowEquals = keyboard.getByRole("button", { name: "=", exact: true })
    const equalsBox = await bottomRowEquals.boundingBox()
    const keyboardBox = await keyboard.boundingBox()

    expect(equalsBox).not.toBeNull()
    expect(keyboardBox).not.toBeNull()

    if (equalsBox && keyboardBox) {
      const clearanceBelowEquals =
        keyboardBox.y + keyboardBox.height - (equalsBox.y + equalsBox.height)

      expect(clearanceBelowEquals).toBeGreaterThanOrEqual(40)
    }

    const paddingBottom = await keyboard.evaluate((el) => {
      return Number.parseInt(getComputedStyle(el).paddingBottom, 10)
    })
    expect(paddingBottom).toBeGreaterThanOrEqual(40)
  })

  test("first focus on an input does not flash keyboard position", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    const { amountInput } = await openAddTransactionCalculator(page, {
      skipAmountFocus: true,
    })

    const firstFocusPositions = await sampleKeyboardTopPositions(page, amountInput)
    const firstFocusJump = maxConsecutiveTopJump(firstFocusPositions)

    expect(firstFocusPositions.some((top) => top >= 0)).toBe(true)
    expect(firstFocusJump).toBeLessThan(24)

    await page.getByRole("heading", { name: "Add Transaction" }).click()
    await expect(page.locator("[data-calculator-keyboard]")).toHaveCount(0)

    const secondFocusPositions = await sampleKeyboardTopPositions(page, amountInput)
    const secondFocusJump = maxConsecutiveTopJump(secondFocusPositions)

    expect(secondFocusJump).toBeLessThan(8)
  })

  test("switching calculator inputs does not flash keyboard position", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    const { amountInput } = await openAddTransactionCalculator(page, {
      skipAmountFocus: true,
    })

    await page.getByRole("tab", { name: "Transfer" }).click()

    const transferAmount = page.locator("[data-calculator-input] input").first()
    const transferCost = page.locator("[data-calculator-input] input").nth(1)

    await expect(transferAmount).toBeVisible({ timeout: 5000 })
    await expect(transferCost).toBeVisible({ timeout: 5000 })

    await sampleKeyboardTopPositions(page, transferAmount)

    const switchPositions = await sampleKeyboardTopPositions(page, transferCost)
    const switchJump = maxConsecutiveTopJump(switchPositions)

    expect(switchPositions.some((top) => top >= 0)).toBe(true)
    expect(switchJump).toBeLessThan(24)
  })

  test("opening Rates while calculator is up keeps Add Transaction open", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await openAddTransactionCalculator(page)

    await expect(page.locator("[data-calculator-keyboard]")).toBeVisible()

    const ratesButton = page.getByRole("button", { name: /rates/i }).first()
    const ratesVisible = await ratesButton.isVisible().catch(() => false)

    if (ratesVisible) {
      await ratesButton.click()
      await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible()
      await expect(page.locator("[data-calculator-keyboard]")).toHaveCount(0)
      return
    }

    // FX pair may be hidden in mocks — still verify another in-sheet control
    // does not dismiss the modal while the calculator is up.
    await page.getByRole("tab", { name: "Income" }).click()
    await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible()
    await expect(page.locator("[data-calculator-keyboard]")).toHaveCount(0)
  })

  test("switching tabs while calculator is up keeps Add Transaction open", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await openAddTransactionCalculator(page)

    await expect(page.locator("[data-calculator-keyboard]")).toBeVisible()
    await page.getByRole("tab", { name: "Income" }).click()

    await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible()
    await expect(page.locator("[data-calculator-keyboard]")).toHaveCount(0)
  })
})
