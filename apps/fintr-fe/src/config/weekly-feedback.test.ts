import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getCurrentIsoWeekKey,
  getThisIsoWeekWednesdayStart,
  isOnOrAfterThisIsoWeekWednesday,
  markWeeklyFeedbackHandled,
  shouldShowWeeklyFeedbackPrompt,
} from "./weekly-feedback";

describe("weekly-feedback config", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean })
      .__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__;
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean })
      .__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__;
  });

  it("getCurrentIsoWeekKey formats ISO week", () => {
    expect(getCurrentIsoWeekKey(new Date("2026-01-05T12:00:00.000Z"))).toBe("2026-W02");
  });

  it("getThisIsoWeekWednesdayStart returns Wednesday 00:00 local for that ISO week", () => {
    const wed = getThisIsoWeekWednesdayStart(new Date("2026-05-13T15:00:00.000Z"));
    expect(wed.getDay()).toBe(3);
  });

  it("isOnOrAfterThisIsoWeekWednesday is false before Wednesday of the ISO week", () => {
    const tuesday = new Date("2026-05-12T12:00:00.000Z");
    expect(isOnOrAfterThisIsoWeekWednesday(tuesday)).toBe(false);
  });

  it("isOnOrAfterThisIsoWeekWednesday is true on Wednesday of the ISO week", () => {
    const wednesday = new Date("2026-05-13T12:00:00.000Z");
    expect(isOnOrAfterThisIsoWeekWednesday(wednesday)).toBe(true);
  });

  it("markWeeklyFeedbackHandled writes action time and current week key", () => {
    const before = Date.now();
    markWeeklyFeedbackHandled();
    const actionAt = Number.parseInt(localStorage.getItem("fintr_weekly_feedback_v1_lastActionAt") ?? "", 10);
    expect(Number.isFinite(actionAt)).toBe(true);
    expect(actionAt).toBeGreaterThanOrEqual(before);
    expect(localStorage.getItem("fintr_weekly_feedback_v1_lastPromptWeekKey")).toBe(
      getCurrentIsoWeekKey(),
    );
  });

  describe("shouldShowWeeklyFeedbackPrompt", () => {
    it("returns false before Wednesday cadence when not in E2E override mode", () => {
      const tuesday = new Date("2026-05-12T12:00:00.000Z");
      expect(shouldShowWeeklyFeedbackPrompt(tuesday)).toBe(false);
    });

    it("returns true on Wednesday when user has not been prompted this ISO week", () => {
      const wednesday = new Date("2026-05-13T12:00:00.000Z");
      expect(shouldShowWeeklyFeedbackPrompt(wednesday)).toBe(true);
    });

    it("returns false on Wednesday when last prompt week matches current week", () => {
      const wednesday = new Date("2026-05-13T12:00:00.000Z");
      const weekKey = getCurrentIsoWeekKey(wednesday);
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", weekKey);
      expect(shouldShowWeeklyFeedbackPrompt(wednesday)).toBe(false);
    });

    it("E2E override shows prompt when week key differs from last prompt", () => {
      (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean }).__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__ =
        true;
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", "2025-W01");
      const wednesday = new Date("2026-05-13T12:00:00.000Z");
      expect(shouldShowWeeklyFeedbackPrompt(wednesday)).toBe(true);
    });

    it("E2E override hides prompt when already prompted this ISO week", () => {
      (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean }).__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__ =
        true;
      const wednesday = new Date("2026-05-13T12:00:00.000Z");
      const weekKey = getCurrentIsoWeekKey(wednesday);
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", weekKey);
      expect(shouldShowWeeklyFeedbackPrompt(wednesday)).toBe(false);
    });
  });
});
