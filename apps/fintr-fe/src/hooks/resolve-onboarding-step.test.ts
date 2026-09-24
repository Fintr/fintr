import { describe, expect, it } from "vitest";

import { resolveOnboardingStep } from "./resolve-onboarding-step";

describe("resolveOnboardingStep", () => {
  it("keeps an explicit incomplete step", () => {
    expect(resolveOnboardingStep("currency", true)).toBe("currency");
    expect(resolveOnboardingStep("income", false)).toBe("income");
  });

  it("keeps completed when provided", () => {
    expect(resolveOnboardingStep("completed", true)).toBe("completed");
  });

  it("treats empty step as completed when the user already has a space", () => {
    expect(resolveOnboardingStep("", true)).toBe("completed");
    expect(resolveOnboardingStep(null, true)).toBe("completed");
    expect(resolveOnboardingStep(undefined, true)).toBe("completed");
  });

  it("treats empty step as currency only when there is no space", () => {
    expect(resolveOnboardingStep("", false)).toBe("currency");
    expect(resolveOnboardingStep(null, false)).toBe("currency");
    expect(resolveOnboardingStep(undefined, false)).toBe("currency");
  });
});
