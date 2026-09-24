import { describe, expect, it } from "vitest";

import {
  DASHBOARD_DESKTOP_NAV_Z_CLASS,
  HOME_CONTENT_SHEET_Z_CLASS,
} from "./dashboard-chrome-stacking";

const unboundedZIndex = (className: string): number | null => {
  const match = className.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
  return match ? Number(match[1]) : null;
};

describe("dashboard chrome stacking", () => {
  it("keeps the desktop header above home sheet content", () => {
    const headerZ = unboundedZIndex(DASHBOARD_DESKTOP_NAV_Z_CLASS);

    expect(headerZ).not.toBeNull();
    expect(headerZ).toBeGreaterThan(20);
    expect(HOME_CONTENT_SHEET_Z_CLASS).toMatch(/max-md:z-\d+/);
    expect(unboundedZIndex(HOME_CONTENT_SHEET_Z_CLASS)).toBeNull();
  });
});
