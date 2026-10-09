import { describe, expect, it } from "vitest";
import { isLightThemePath } from "./theme-routes";

describe("isLightThemePath", () => {
  it("keeps marketing pages light", () => {
    expect(isLightThemePath("/")).toBe(true);
    expect(isLightThemePath("/contact-us")).toBe(true);
    expect(isLightThemePath("/discover")).toBe(true);
  });

  it("leaves the signed-in app on the user theme", () => {
    expect(isLightThemePath("/dashboard")).toBe(false);
    expect(isLightThemePath("/consent")).toBe(false);
  });
});
