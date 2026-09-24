import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import { getMonthDateRange } from "@/utils/dateUtils";
import type { BudgetsPage } from "@/types/budgetTypes";

import { normalizeBudgetsPage } from "./normalize-budgets-page";

const budgetsKey = (
  spaceCode: string,
  startDate: string,
  endDate: string,
): string => `budgetsResponse:${spaceCode}:${startDate}:${endDate}`;

const sameCalendarMonthRange = (
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } | null => {
  const startMatch = /^(\d{4})-(\d{2})/.exec(startDate);
  const endMatch = /^(\d{4})-(\d{2})/.exec(endDate);
  if (!startMatch || !endMatch) {
    return null;
  }

  if (startMatch[1] !== endMatch[1] || startMatch[2] !== endMatch[2]) {
    return null;
  }

  return getMonthDateRange(Number(startMatch[1]), Number(startMatch[2]));
};

export const cacheBudgetsResponse = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
  page: BudgetsPage,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    const normalized = normalizeBudgetsPage(page);

    await putLocalResponseSnapshot(
      budgetsKey(spaceCode, startDate, endDate),
      normalized,
    );

    const calendar = sameCalendarMonthRange(startDate, endDate);
    if (
      calendar
      && (calendar.startDate !== startDate || calendar.endDate !== endDate)
    ) {
      await putLocalResponseSnapshot(
        budgetsKey(spaceCode, calendar.startDate, calendar.endDate),
        normalized,
      );
    }
  } catch (error) {
    console.warn("[local-db] Failed to cache budgets response", error);
  }
};

export const loadCachedBudgetsResponse = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<BudgetsPage | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const exact = await getLocalResponseSnapshot<BudgetsPage>(
      budgetsKey(spaceCode, startDate, endDate),
    );
    if (exact) {
      return normalizeBudgetsPage(exact);
    }

    const calendar = sameCalendarMonthRange(startDate, endDate);
    if (
      !calendar
      || (calendar.startDate === startDate && calendar.endDate === endDate)
    ) {
      return undefined;
    }

    // Same calendar month as a full-month bootstrap snapshot (e.g. 1st–today).
    const calendarSnapshot = await getLocalResponseSnapshot<BudgetsPage>(
      budgetsKey(spaceCode, calendar.startDate, calendar.endDate),
    );
    if (!calendarSnapshot) {
      return undefined;
    }

    return normalizeBudgetsPage(calendarSnapshot);
  } catch (error) {
    console.warn("[local-db] Failed to load cached budgets", error);
    return undefined;
  }
};
