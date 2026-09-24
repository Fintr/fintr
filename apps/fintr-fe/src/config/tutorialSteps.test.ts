import { describe, expect, it } from "vitest";

import {
  getTutorialConfig,
  resolveTutorialPlatform,
} from "./tutorialSteps";

describe("resolveTutorialPlatform", () => {
  it("uses the desktop tour when the layout is wide enough to hide the menu button", () => {
    expect(resolveTutorialPlatform(768)).toBe("desktop");
    expect(resolveTutorialPlatform(1280)).toBe("desktop");
  });

  it("uses the mobile tour when the bottom menu is on screen", () => {
    expect(resolveTutorialPlatform(767)).toBe("mobile");
    expect(resolveTutorialPlatform(390)).toBe("mobile");
  });
});

describe("getTutorialConfig", () => {
  it("leaves the menu button out of the desktop tour", () => {
    const ids = getTutorialConfig("desktop", "PHP").steps.map((step) => step.id);

    expect(ids).not.toContain("mobile-menu-button");
    expect(ids).toContain("dashboard-loan-tab");
  });

  it("keeps the menu button in the mobile tour", () => {
    const ids = getTutorialConfig("mobile", "PHP").steps.map((step) => step.id);

    expect(ids).toContain("mobile-menu-button");
  });
});
