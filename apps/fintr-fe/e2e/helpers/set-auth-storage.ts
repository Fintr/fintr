import type { Page } from "@playwright/test"

import { buildTestJwt } from "./build-test-jwt"
import { auth0LocalStorageKeySuffix } from "./auth0-storage-suffix"

export async function setAuthStorageForE2e(
  page: Page,
  options?: {
    email?: string
    spaceCode?: string
    name?: string
    sub?: string
  },
): Promise<void> {
  const domainSuffix = auth0LocalStorageKeySuffix()
  const email = options?.email ?? "test@example.com"
  const spaceCode = options?.spaceCode ?? "test-space"
  const name = options?.name ?? "Test User"
  const sub = options?.sub ?? "auth0|e2e-user"
  const accessToken = buildTestJwt({ email, name, sub })
  const idToken = buildTestJwt({ email, name, sub })

  await page.addInitScript(
    ({ domain, userEmail, userSpaceCode, userName, userSub, access, id }) => {
      const mockUser = {
        sub: userSub,
        email: userEmail,
        name: userName,
      }
      const mockTokens = {
        access_token: access,
        id_token: id,
        refresh_token: "e2e-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid profile email",
      }
      const expiresAt = Date.now() + 3_600_000
      const issuedAt = Date.now()
      const domainSuffixes = Array.from(
        new Set([domain, "default"].filter(Boolean)),
      )

      for (const suffix of domainSuffixes) {
        localStorage.setItem(
          `@@auth0@@.access_token.${suffix}`,
          mockTokens.access_token,
        )
        localStorage.setItem(`@@auth0@@.id_token.${suffix}`, mockTokens.id_token)
        localStorage.setItem(
          `@@auth0@@.refresh_token.${suffix}`,
          mockTokens.refresh_token,
        )
        localStorage.setItem(
          `@@auth0@@.expires_at.${suffix}`,
          expiresAt.toString(),
        )
        localStorage.setItem(
          `@@auth0@@.user.${suffix}`,
          JSON.stringify(mockUser),
        )
        localStorage.setItem(`@@auth0@@.scope.${suffix}`, mockTokens.scope)
        localStorage.setItem(
          `@@auth0@@.issued_at.${suffix}`,
          issuedAt.toString(),
        )
      }

      localStorage.setItem("auth_tokens", JSON.stringify(mockTokens))
      localStorage.setItem(
        "fintr_auth_data",
        JSON.stringify({ tokens: mockTokens, user: mockUser }),
      )
      localStorage.setItem("spaceCode", userSpaceCode)
    },
    {
      domain: domainSuffix,
      userEmail: email,
      userSpaceCode: spaceCode,
      userName: name,
      userSub: sub,
      access: accessToken,
      id: idToken,
    },
  )
}
