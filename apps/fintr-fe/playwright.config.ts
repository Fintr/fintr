import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for testing mobile layouts and safe area handling
 * Tests across Android, iOS, and browser mobile viewports
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: "html",

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",

    /* Backend API URL for e2e tests that hit the real backend */
    /* Set E2E_BE_URL env var if backend runs on a different port/host */

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers and mobile viewports */
  projects: [
    // Desktop browsers
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile Chrome (Android browser)
    {
      name: "Mobile Chrome - Small",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 393, height: 851 },
      },
    },
    {
      name: "Mobile Chrome - Large",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 915 },
      },
    },

    // Mobile Safari (iOS browser)
    {
      name: "Mobile Safari - iPhone SE",
      use: {
        ...devices["iPhone SE"],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "Mobile Safari - iPhone 14",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "Mobile Safari - iPhone 14 Pro Max",
      use: {
        ...devices["iPhone 14 Pro Max"],
        viewport: { width: 430, height: 932 },
      },
    },

    // Tablet viewports
    {
      name: "Tablet Chrome",
      use: { ...devices["Galaxy Tab S4"] },
    },
    {
      name: "Tablet Safari",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
