import { describe, expect, it } from "vitest";

import { shouldResetScrollOnNavigate } from "./should-reset-scroll-on-navigate";

describe("shouldResetScrollOnNavigate", () => {
  it("does not reset when moving between bottom-nav tabs", () => {
    expect(
      shouldResetScrollOnNavigate("/dashboard/home", "/dashboard/insights"),
    ).toBe(false);
    expect(
      shouldResetScrollOnNavigate("/dashboard/", "/dashboard/app_settings"),
    ).toBe(false);
  });

  it("does not reset when moving between cached desktop index tabs", () => {
    expect(
      shouldResetScrollOnNavigate("/dashboard/home", "/dashboard/recurring"),
    ).toBe(false);
    expect(
      shouldResetScrollOnNavigate("/dashboard/app_settings", "/dashboard/budgets"),
    ).toBe(false);
  });

  it("resets when leaving a bottom-nav tab for a nested page", () => {
    expect(
      shouldResetScrollOnNavigate(
        "/dashboard/app_settings",
        "/dashboard/space_settings/accounts",
      ),
    ).toBe(true);
    expect(
      shouldResetScrollOnNavigate("/dashboard/", "/dashboard/transactions/detail"),
    ).toBe(true);
    expect(
      shouldResetScrollOnNavigate("/dashboard/", "/dashboard/recurring/detail"),
    ).toBe(true);
  });
});
