/**
 * Test mocks and fixtures for platform detection testing
 */

export const userAgents = {
  // Android Native
  androidNativeApp:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",

  // iOS Native
  iosNativeApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp",
  iosWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",

  // Browser Mobile
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",

  // Desktop
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  desktopSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
} as const

export const safeAreaScenarios = {
  // No safe area (older devices or no notches)
  noSafeArea: {
    bottom: 0,
    top: 0,
    left: 0,
    right: 0,
  },

  // Small safe area (minimal notch/home indicator)
  smallSafeArea: {
    bottom: 8,
    top: 30,
    left: 0,
    right: 0,
  },

  // Large safe area (pill-shaped notch, large home indicator)
  largeSafeArea: {
    bottom: 34,
    top: 47,
    left: 0,
    right: 0,
  },

  // Android 3-button navigation (48px minimum)
  android3ButtonNav: {
    bottom: 48,
    top: 0,
    left: 0,
    right: 0,
  },

  // Android gesture navigation (smaller area)
  androidGestureNav: {
    bottom: 16,
    top: 0,
    left: 0,
    right: 0,
  },
} as const

/**
 * Create a mock document element with classList
 */
export const createMockDocumentElement = (options: {
  androidClass?: boolean
  iosClass?: boolean
} = {}) => {
  const classes: string[] = []
  if (options.androidClass) classes.push("fintr-native-android")
  if (options.iosClass) classes.push("fintr-native-ios")

  return {
    classList: {
      contains: (className: string) => classes.includes(className),
      add: (className: string) => {
        if (!classes.includes(className)) classes.push(className)
      },
      remove: (className: string) => {
        const index = classes.indexOf(className)
        if (index > -1) classes.splice(index, 1)
      },
      toggle: (className: string) => {
        const index = classes.indexOf(className)
        if (index > -1) {
          classes.splice(index, 1)
          return false
        }
        classes.push(className)
        return true
      },
    },
  }
}

/**
 * Mock CSS computed style for safe area testing
 */
export const mockComputedStyle = (
  insets: (typeof safeAreaScenarios)[keyof typeof safeAreaScenarios]
) => {
  return {
    getPropertyValue: (property: string) => {
      const values: Record<string, string> = {
        "--safe-area-inset-bottom": `${insets.bottom}px`,
        "--safe-area-inset-top": `${insets.top}px`,
        "--safe-area-inset-left": `${insets.left}px`,
        "--safe-area-inset-right": `${insets.right}px`,
      }
      return values[property] || ""
    },
  }
}
