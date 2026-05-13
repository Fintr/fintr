import type { Page } from "@playwright/test"
import { getCurrentIsoWeekKey } from "@/config/weekly-feedback"

/**
 * Weekly feedback uses a Radix dialog overlay that blocks the whole UI.
 * Prime the same keys as {@link markWeeklyFeedbackHandled} so the prompt never opens in E2E.
 */
export async function primeWeeklyFeedbackDismissed(page: Page): Promise<void> {
  const weekKey = getCurrentIsoWeekKey(new Date())
  await page.addInitScript((wk) => {
    localStorage.setItem("fintr_weekly_feedback_v1_lastActionAt", String(Date.now()))
    localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", wk)
  }, weekKey)
}
