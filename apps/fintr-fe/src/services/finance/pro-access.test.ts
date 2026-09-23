import { beforeEach, describe, expect, it } from "vitest";

import {
  readCachedProAccess,
  writeCachedProAccess,
  type ProAccess,
} from "./pro-access";

const access: ProAccess = {
  pro: true,
  source: "trial",
  appUserId: "user-1",
  trialEndsAt: "2026-09-29T00:00:00Z",
  trialDaysRemaining: 7,
  proExpiresAt: null,
  features: [],
};

describe("pro access cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("remembers Pro access for offline use", () => {
    writeCachedProAccess(access);

    expect(readCachedProAccess()).toEqual(access);
  });

  it("ignores a cache entry that is not Pro access", () => {
    window.localStorage.setItem("fintr.proAccess", JSON.stringify({ used: 3 }));

    expect(readCachedProAccess()).toBeNull();
  });
});
