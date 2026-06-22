export function buildTestJwt(
  payload: Record<string, unknown> = {},
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url")
  const body = Buffer.from(
    JSON.stringify({
      sub: "auth0|e2e-user",
      email: "test@example.com",
      name: "Test User",
      ...payload,
    }),
  ).toString("base64url")

  return `${header}.${body}.e2e-signature`
}
