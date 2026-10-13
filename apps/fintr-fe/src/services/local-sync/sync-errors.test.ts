import { describe, expect, it } from "vitest";

import { isSessionAuthError } from "./sync-errors";

describe("isSessionAuthError", () => {
  it("recognizes an expired JWT rethrown as the API body", () => {
    expect(
      isSessionAuthError({
        success: false,
        error: { message: "Bad credentials: Signature has expired" },
      }),
    ).toBe(true);
  });

  it("recognizes the Secured concern bodies", () => {
    expect(isSessionAuthError({ message: "Bad credentials" })).toBe(true);
    expect(isSessionAuthError({ message: "Requires authentication" })).toBe(true);
  });

  it("recognizes a raw Axios 401 with a credentials message", () => {
    expect(
      isSessionAuthError({
        response: {
          status: 401,
          data: { success: false, error: { message: "Bad credentials" } },
        },
      }),
    ).toBe(true);
  });

  it("ignores validation errors and non-session 401s", () => {
    expect(
      isSessionAuthError({ success: false, details: { amount: ["is invalid"] } }),
    ).toBe(false);
    expect(
      isSessionAuthError({ success: false, error: { message: "Unauthorized" } }),
    ).toBe(false);
    expect(isSessionAuthError(new Error("Failed to create transaction"))).toBe(false);
  });
});
