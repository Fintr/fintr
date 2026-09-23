import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import type { BudgetsPage } from "@/types/budgetTypes";

import { applyBudgetsPageToCaches, loadBudgetsPage, type BudgetRow } from "./budget-cache-ops";
import {
  calendarMonthRangeFromStart,
  monthHasPersistedBudgets,
  previousCalendarMonthRange,
} from "./create-monthly-budget";
import { fetchBudgetsPage } from "./queries";

export type HydrateBudgetsFromServerResult = {
  hydratedMonths: number;
};

const asBudgetRow = (value: unknown): BudgetRow =>
  (value ?? {}) as BudgetRow;

const hasPendingLocalCreates = (page: BudgetsPage | undefined): boolean => {
  if (!page?.budgets?.length) {
    return false;
  }

  return page.budgets.some((raw) => {
    const row = asBudgetRow(raw);
    if (String(row.id ?? "").startsWith("local:")) {
      return true;
    }

    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories
      : [];

    return subcategories.some((sub) =>
      String(asBudgetRow(sub).id ?? "").startsWith("local:"),
    );
  });
};

const recentCalendarMonthRanges = (
  asOfStartDate: string,
  monthCount: number,
): Array<{ startDate: string; endDate: string }> => {
  const ranges: Array<{ startDate: string; endDate: string }> = [];
  let cursor = calendarMonthRangeFromStart(asOfStartDate);
  for (let index = 0; index < monthCount && cursor; index += 1) {
    ranges.push(cursor);
    cursor = previousCalendarMonthRange(cursor.startDate);
  }

  return ranges;
};

export const hydrateBudgetsFromServer = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    asOfStartDate?: string;
    monthCount?: number;
  },
  options: {
    queryClient?: QueryClient;
  } = {},
): Promise<HydrateBudgetsFromServerResult> => {
  const { spaceCode } = params;
  if (!spaceCode) {
    return { hydratedMonths: 0 };
  }

  const now = new Date();
  const asOfStartDate = params.asOfStartDate
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthCount = params.monthCount ?? 3;
  const ranges = recentCalendarMonthRanges(asOfStartDate, monthCount);
  let hydratedMonths = 0;

  for (const range of ranges) {
    const existing = await loadBudgetsPage(
      spaceCode,
      range.startDate,
      range.endDate,
    );
    if (hasPendingLocalCreates(existing)) {
      continue;
    }

    const page = await fetchBudgetsPage(api, {
      queryKey: ["budgets", spaceCode, range.startDate, range.endDate],
      requestConfig: {
        headers: {
          "X-Space-Code": spaceCode,
        },
      },
    });
    if (!monthHasPersistedBudgets(page)) {
      continue;
    }

    await applyBudgetsPageToCaches({
      spaceCode,
      startDate: range.startDate,
      endDate: range.endDate,
      page,
      queryClient: options.queryClient,
    });
    hydratedMonths += 1;
  }

  return { hydratedMonths };
};
