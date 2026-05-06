import { Page } from "@playwright/test"

/**
 * Sets up the frontend's localStorage so the Auth0 React SDK believes
 * the user is already authenticated. This prevents the frontend from
 * redirecting to /login before our API interceptors kick in.
 */
export async function setupFrontendAuth(
  page: Page,
  user: { email: string; user_id: string; space_code?: string }
): Promise<void> {
  await page.evaluate((userData) => {
    const domain = "fintr_jp_auth0_com"
    const mockUser = {
      sub: `e2e-${userData.user_id}`,
      email: userData.email,
      name: "E2E Test User",
    }
    const mockTokens = {
      access_token: "e2e-mock-token",
      id_token: "e2e-mock-id-token",
      refresh_token: "e2e-mock-refresh",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid profile email",
    }
    const expiresAt = Date.now() + 3600000

    localStorage.setItem(`@@auth0@@.access_token.${domain}`, mockTokens.access_token)
    localStorage.setItem(`@@auth0@@.id_token.${domain}`, mockTokens.id_token)
    localStorage.setItem(`@@auth0@@.refresh_token.${domain}`, mockTokens.refresh_token)
    localStorage.setItem(`@@auth0@@.expires_at.${domain}`, expiresAt.toString())
    localStorage.setItem(`@@auth0@@.user.${domain}`, JSON.stringify(mockUser))
    localStorage.setItem(`@@auth0@@.scope.${domain}`, mockTokens.scope)
    localStorage.setItem(`@@auth0@@.issued_at.${domain}`, Date.now().toString())
    localStorage.setItem("fintr_auth_data", JSON.stringify({ tokens: mockTokens, user: mockUser }))

    if (userData.space_code) {
      localStorage.setItem("spaceCode", userData.space_code)
    }
  }, user)
}
