import { addDays, getISOWeek, getISOWeekYear, startOfDay, startOfISOWeek } from "date-fns";

export const WEEKLY_FEEDBACK_MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
// export const WEEKLY_FEEDBACK_MIN_INTERVAL_MS = 60;

/**
 * Pulse feedback area ids. Keep in sync with
 * `ProductPulse::Operations::CreateFeedback::ALLOWED_AREA_IDS` in fintr-be.
 */
export const FEEDBACK_AREA_IDS = [
  "transactions",
  "budgets",
  "loans",
  "insights",
  "ai_assistant",
  "subscriptions",
  "settings",
  "mobile_experience",
  "speed",
  "visual_design",
] as const;

export type FeedbackAreaId = (typeof FEEDBACK_AREA_IDS)[number];

export const FEEDBACK_AREA_OPTIONS: { id: FeedbackAreaId; label: string }[] = [
  { id: "transactions", label: "Transactions" },
  { id: "budgets", label: "Budgets" },
  { id: "loans", label: "Loans" },
  { id: "insights", label: "Dashboard insights" },
  { id: "ai_assistant", label: "AI assistant" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "settings", label: "Settings" },
  { id: "mobile_experience", label: "Mobile experience" },
  { id: "speed", label: "Speed" },
  { id: "visual_design", label: "Look & feel" },
];

export function feedbackAreaLabel(id: string): string {
  return FEEDBACK_AREA_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

const STORAGE_LAST_ACTION_AT = "fintr_weekly_feedback_v1_lastActionAt";
const STORAGE_LAST_PROMPT_WEEK_KEY = "fintr_weekly_feedback_v1_lastPromptWeekKey";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getCurrentIsoWeekKey(date: Date = new Date()): string {
  const y = getISOWeekYear(date);
  const w = getISOWeek(date);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function getThisIsoWeekWednesdayStart(date: Date = new Date()): Date {
  const monday = startOfISOWeek(date);
  return startOfDay(addDays(monday, 2));
}

export function isOnOrAfterThisIsoWeekWednesday(date: Date = new Date()): boolean {
  const wed = getThisIsoWeekWednesdayStart(date);
  const dayStart = startOfDay(date);
  return dayStart.getTime() >= wed.getTime();
}

export function isWeeklyFeedbackTestMode(): boolean {
  return WEEKLY_FEEDBACK_MIN_INTERVAL_MS < ONE_DAY_MS;
}

function readLastActionAt(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_LAST_ACTION_AT);
  if (!raw) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function readLastPromptWeekKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(STORAGE_LAST_PROMPT_WEEK_KEY);
}

export function markWeeklyFeedbackHandled(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_LAST_ACTION_AT, String(Date.now()));
  localStorage.setItem(STORAGE_LAST_PROMPT_WEEK_KEY, getCurrentIsoWeekKey());
}

export function shouldShowWeeklyFeedbackPrompt(now: Date = new Date()): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const lastActionAt = readLastActionAt();
  const lastWeekKey = readLastPromptWeekKey();
  const currentWeekKey = getCurrentIsoWeekKey(now);

  const e2eShow = (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean })
    .__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__;
  if (e2eShow) {
    // Playwright sets this via addInitScript; still respects “already handled this ISO week”.
    if (lastWeekKey === currentWeekKey) {
      return false;
    }
    return true;
  }

  if (isWeeklyFeedbackTestMode()) {
    if (lastActionAt == null) {
      return true;
    }
    return now.getTime() - lastActionAt >= WEEKLY_FEEDBACK_MIN_INTERVAL_MS;
  }

  if (!isOnOrAfterThisIsoWeekWednesday(now)) {
    return false;
  }

  if (lastWeekKey === currentWeekKey) {
    return false;
  }

  if (lastActionAt != null) {
    if (now.getTime() - lastActionAt < WEEKLY_FEEDBACK_MIN_INTERVAL_MS) {
      return false;
    }
  }

  return true;
}
