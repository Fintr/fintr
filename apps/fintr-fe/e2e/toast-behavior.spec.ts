import { test, expect } from "@playwright/test"
import { mockCommonDashboardApi } from "./helpers/mock-common-api"
import { primeWeeklyFeedbackDismissed } from "./helpers/prime-weekly-feedback-dismissed"
import { setAuthStorageForE2e } from "./helpers/set-auth-storage"
import { triggerE2eToast } from "./helpers/trigger-e2e-toast"

const TOAST_DISMISS_TIMEOUT_MS = 4000
const MOBILE_VIEWPORT_MAX_WIDTH = 768

type NativeClassOptions = {
  platform?: "android" | "ios"
  safeAreaTop?: string
  safeAreaBottom?: string
  androidThreeButtonNav?: boolean
}

async function openDashboardForToast(
  page: import("@playwright/test").Page,
  options?: {
    nativeClasses?: NativeClassOptions
  },
) {
  await setAuthStorageForE2e(page)
  await primeWeeklyFeedbackDismissed(page)
  await mockCommonDashboardApi(page)

  await page.goto("/dashboard/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  await page.waitForTimeout(1500)

  if (options?.nativeClasses) {
    await primeNativePlatformClasses(page, options.nativeClasses)
  }
}

async function primeNativePlatformClasses(
  page: import("@playwright/test").Page,
  options: NativeClassOptions,
): Promise<void> {
  await page.evaluate((config) => {
    const html = document.documentElement

    html.classList.remove("fintr-native-android", "fintr-native-ios", "fintr-has-3btn-nav")

    if (config.platform === "android") {
      html.classList.add("fintr-native-android")
    }

    if (config.platform === "ios") {
      html.classList.add("fintr-native-ios")
    }

    if (config.androidThreeButtonNav) {
      html.classList.add("fintr-has-3btn-nav")
    }

    if (config.safeAreaTop) {
      html.style.setProperty("--safe-area-inset-top", config.safeAreaTop)
    }

    if (config.safeAreaBottom) {
      html.style.setProperty("--safe-area-inset-bottom", config.safeAreaBottom)
    }

    window.dispatchEvent(new Event("resize"))
  }, options)
  await page.waitForTimeout(750)
}

function isMobileViewport(page: import("@playwright/test").Page): boolean {
  const width = page.viewportSize()?.width ?? 0
  return width > 0 && width <= MOBILE_VIEWPORT_MAX_WIDTH
}

async function waitForMountedToast(page: import("@playwright/test").Page) {
  const toast = page.locator('[data-sonner-toast][data-mounted="true"]').first()
  await expect(toast).toBeVisible({ timeout: 5000 })

  await page.waitForFunction(() => {
    const toastEl = document.querySelector('[data-sonner-toast][data-mounted="true"]')
    const toasterEl = document.querySelector("[data-sonner-toaster]")
    if (!toastEl || !toasterEl) {
      return false
    }

    const toastRect = toastEl.getBoundingClientRect()
    const mobileTop = getComputedStyle(toasterEl).getPropertyValue("--mobile-offset-top").trim()
    const desktopTop = getComputedStyle(toasterEl).getPropertyValue("--offset-top").trim()
    const toasterTop =
      Number.parseFloat(mobileTop) ||
      Number.parseFloat(desktopTop) ||
      Number.parseFloat(getComputedStyle(toasterEl).top) ||
      0

    return toastRect.top >= toasterTop - 4 && toastRect.top < 200
  }, { timeout: 10000 })

  return toast
}

async function getToasterTopOffset(page: import("@playwright/test").Page): Promise<number> {
  return page.locator("[data-sonner-toaster]").evaluate((el) => {
    const mobileTop = getComputedStyle(el).getPropertyValue("--mobile-offset-top").trim()
    const desktopTop = getComputedStyle(el).getPropertyValue("--offset-top").trim()
    const resolvedTop = getComputedStyle(el).top

    return (
      Number.parseFloat(mobileTop) ||
      Number.parseFloat(desktopTop) ||
      Number.parseFloat(resolvedTop) ||
      0
    )
  })
}

test.describe("Toast behavior", () => {
  test("mobile toast renders at the top below the status bar", async ({ page }) => {
    test.skip(!isMobileViewport(page), "Mobile viewport only")

    await openDashboardForToast(page)
    await triggerE2eToast(page)

    const toaster = page.locator("[data-sonner-toaster]")
    await expect(toaster).toHaveAttribute("data-y-position", "top", {
      timeout: 10000,
    })
    await expect(toaster).toHaveAttribute("data-x-position", "center", {
      timeout: 10000,
    })

    const toast = await waitForMountedToast(page)
    const box = await toast.boundingBox()
    const toasterTop = await getToasterTopOffset(page)

    expect(box).toBeTruthy()
    expect(toasterTop).toBeGreaterThanOrEqual(16)
    expect(box!.y).toBeGreaterThanOrEqual(toasterTop - 4)
    expect(box!.y).toBeLessThan(120)
  })

  test("desktop toast renders at the top-right", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      "Desktop layout only",
    )

    await openDashboardForToast(page)
    await triggerE2eToast(page)

    const toaster = page.locator("[data-sonner-toaster]")
    await expect(toaster).toHaveAttribute("data-y-position", "top", {
      timeout: 5000,
    })
    await expect(toaster).toHaveAttribute("data-x-position", "right", {
      timeout: 5000,
    })
  })

  test("toast auto-dismisses after about 3 seconds", async ({ page }) => {
    await openDashboardForToast(page)
    await triggerE2eToast(page)

    const toast = page.locator("[data-sonner-toast]")
    await expect(toast).toBeVisible({ timeout: 5000 })
    await expect(toast).toHaveCount(0, { timeout: TOAST_DISMISS_TIMEOUT_MS })
  })

  test("android native toast renders below the status bar", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("Chrome"),
      "Android mobile chrome only",
    )

    const nativeClasses = {
      platform: "android" as const,
      safeAreaTop: "24px",
      safeAreaBottom: "48px",
      androidThreeButtonNav: true,
    }

    await openDashboardForToast(page, { nativeClasses })

    await expect(page.locator("html")).toHaveClass(/fintr-native-android/)

    await triggerE2eToast(page)

    const toaster = page.locator("[data-sonner-toaster]")
    await expect(toaster).toHaveAttribute("data-y-position", "top", {
      timeout: 10000,
    })

    const toast = await waitForMountedToast(page)
    const box = await toast.boundingBox()
    const toasterTop = await getToasterTopOffset(page)

    expect(box).toBeTruthy()
    expect(toasterTop).toBeGreaterThanOrEqual(20)
    expect(box!.y).toBeGreaterThanOrEqual(toasterTop - 4)
    expect(box!.y).toBeLessThan(100)
  })

  test("ios native toast renders below the notch safe area", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("iPhone"),
      "iPhone viewport only",
    )

    const nativeClasses = {
      platform: "ios" as const,
      safeAreaTop: "47px",
      safeAreaBottom: "34px",
    }

    await openDashboardForToast(page, { nativeClasses })

    await expect(page.locator("html")).toHaveClass(/fintr-native-ios/)

    await triggerE2eToast(page)

    const toaster = page.locator("[data-sonner-toaster]")
    await expect(toaster).toHaveAttribute("data-y-position", "top", {
      timeout: 10000,
    })

    const toast = await waitForMountedToast(page)
    const box = await toast.boundingBox()
    const toasterTop = await getToasterTopOffset(page)

    expect(box).toBeTruthy()
    expect(toasterTop).toBeGreaterThanOrEqual(20)
    expect(box!.y).toBeGreaterThanOrEqual(toasterTop - 4)
    expect(box!.y).toBeLessThan(120)
  })
})
