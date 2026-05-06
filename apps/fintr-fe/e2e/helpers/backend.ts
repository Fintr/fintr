import { Page, request } from "@playwright/test"

const BE_URL = process.env.E2E_BE_URL || "http://localhost:3000"

/**
 * Creates or retrieves the e2e test user in the backend.
 * Returns user details including user_id, email, auth_id, and space_code.
 */
export async function getOrCreateTestUser(): Promise<{
  user_id: string
  email: string
  auth_id: string
  space_code: string
}> {
  const context = await request.newContext()
  const response = await context.post(`${BE_URL}/api/v1/e2e/setup`)
  const data = await response.json()
  await context.dispose()
  return data
}

/**
 * Resets all test data (transactions, budgets) for the e2e test user.
 * Call this in test teardown to keep tests isolated.
 */
export async function resetTestData(): Promise<void> {
  const context = await request.newContext()
  await context.post(`${BE_URL}/api/v1/e2e/reset`)
  await context.dispose()
}

/**
 * Intercepts all API requests from the frontend and injects e2e test auth headers.
 * This bypasses Auth0 JWT validation in the backend (development only).
 */
export async function interceptApiForE2E(page: Page, userId: string): Promise<void> {
  // Intercept Auth0 token refresh requests and return a mock token
  // so the frontend's axios interceptor doesn't fail
  await page.route("**/fintr.jp.auth0.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-mock-token",
        id_token: "e2e-mock-id-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    })
  })

  // Intercept all backend API requests and replace auth with e2e bypass headers
  await page.route("**/api/v1/**", async (route, request) => {
    const headers = { ...request.headers() }

    // Remove the real (or mock) Auth0 token — the backend bypass ignores it
    delete headers["authorization"]

    // Add e2e test bypass headers that the backend recognizes in development
    headers["x-e2e-test-auth"] = "playwright"
    headers["x-e2e-test-user-id"] = userId

    await route.continue({ headers })
  })
}
