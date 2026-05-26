import { describe, it, expect } from "vitest";
import { isJwtToken, resolveApiBearerToken } from "./auth-storage";

const JWT_ACCESS =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhY2Nlc3MifQ.sig";
const JWT_ID =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpZCJ9.sig";
const JWE_ACCESS = "a..b.c.d.e";
const OPAQUE_ACCESS = "opaque-auth0-access-token";

describe("isJwtToken", () => {
  it("returns true for three-segment JWTs", () => {
    expect(isJwtToken(JWT_ACCESS)).toBe(true);
  });

  it("returns false for opaque and JWE tokens", () => {
    expect(isJwtToken(OPAQUE_ACCESS)).toBe(false);
    expect(isJwtToken(JWE_ACCESS)).toBe(false);
    expect(isJwtToken("")).toBe(false);
  });
});

describe("resolveApiBearerToken", () => {
  it("prefers JWT access tokens", () => {
    expect(
      resolveApiBearerToken({
        access_token: JWT_ACCESS,
        id_token: JWT_ID,
      }),
    ).toBe(JWT_ACCESS);
  });

  it("uses id_token when access token is encrypted (JWE)", () => {
    expect(
      resolveApiBearerToken({
        access_token: JWE_ACCESS,
        id_token: JWT_ID,
      }),
    ).toBe(JWT_ID);
  });

  it("uses id_token when access token is opaque", () => {
    expect(
      resolveApiBearerToken({
        access_token: OPAQUE_ACCESS,
        id_token: JWT_ID,
      }),
    ).toBe(JWT_ID);
  });
});
