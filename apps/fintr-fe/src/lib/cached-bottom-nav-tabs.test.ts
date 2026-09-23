import { describe, expect, it } from "vitest";

import {
  MAX_CACHED_BOTTOM_NAV_SCREENS,
  nextCachedBottomNavTabs,
} from "./cached-bottom-nav-tabs";

describe("nextCachedBottomNavTabs", () => {
  it("caps cached screens so visiting every tab cannot keep all eight mounted", () => {
    expect(MAX_CACHED_BOTTOM_NAV_SCREENS).toBe(4);

    const afterFour = nextCachedBottomNavTabs(
      ["home", "transactions", "insights"],
      "menu",
    );

    expect(afterFour).toEqual(["home", "transactions", "insights", "menu"]);

    const afterFifth = nextCachedBottomNavTabs(afterFour, "budgets");

    expect(afterFifth).toEqual(["transactions", "insights", "menu", "budgets"]);
    expect(afterFifth).not.toContain("home");
  });

  it("moves a revisited tab to the most-recent slot without growing the list", () => {
    const next = nextCachedBottomNavTabs(
      ["home", "transactions", "insights", "menu"],
      "home",
    );

    expect(next).toEqual(["transactions", "insights", "menu", "home"]);
  });

  it("leaves the cache unchanged on nested dashboard routes", () => {
    expect(
      nextCachedBottomNavTabs(["home", "transactions"], null),
    ).toEqual(["home", "transactions"]);
  });
});
