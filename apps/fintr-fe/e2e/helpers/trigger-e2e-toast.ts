import type { Page } from "@playwright/test"

export async function triggerE2eToast(
  page: Page,
  message: string = "E2E test toast",
): Promise<void> {
  await page.evaluate((toastMessage) => {
    window.__fintrE2e?.showToast(toastMessage)
  }, message)
}

export async function applyNativeSafeAreaClasses(
  page: Page,
  options?: {
    platform?: "android" | "ios"
    safeAreaTop?: string
    safeAreaBottom?: string
    androidThreeButtonNav?: boolean
  },
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
  }, {
    platform: options?.platform,
    safeAreaTop: options?.safeAreaTop,
    safeAreaBottom: options?.safeAreaBottom,
    androidThreeButtonNav: options?.androidThreeButtonNav ?? false,
  })
}
