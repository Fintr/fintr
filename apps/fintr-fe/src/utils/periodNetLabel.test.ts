import { describe, expect, it } from "vitest";
import { periodNetLabel } from "./periodNetLabel";

describe("periodNetLabel", () => {
  it("labels a surplus as Net Income", () => {
    expect(periodNetLabel(10_563.52)).toBe("Net Income");
    expect(periodNetLabel(0)).toBe("Net Income");
  });

  it("labels a shortfall as Net Deficit", () => {
    expect(periodNetLabel(-1)).toBe("Net Deficit");
  });
});
