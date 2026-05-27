import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-routes";

describe("isPublicPath", () => {
  it("treats marketing homepage paths as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath(null)).toBe(true);
    expect(isPublicPath("")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/auth")).toBe(true);
  });

  it("treats dashboard paths as protected", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/onboarding/step1")).toBe(false);
  });
});
