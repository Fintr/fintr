import type { Page } from "@playwright/test"

import { PLAYWRIGHT_PERSONAL_WORKSPACE } from "./personal-workspace-credentials"

export async function loginToPersonalWorkspace(page: Page): Promise<void> {
  const { email, password } = PLAYWRIGHT_PERSONAL_WORKSPACE

  await page.goto("/auth")
  await page.locator("#login-email, input[name='email']").fill(email)
  await page.locator("#login-password, input[name='password']").fill(password)
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30000 })
}
