import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

const budgetsKey = (
  spaceCode: string,
  startDate: string,
  endDate: string,
): string => `budgetsResponse:${spaceCode}:${startDate}:${endDate}`;

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
    await putLocalResponseSnapshot(
      budgetsKey(spaceCode, startDate, endDate),
      page,
    );
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
    // Exact range only — all-time budgets are not a substitute for a month.
    return await getLocalResponseSnapshot<BudgetsPage>(
      budgetsKey(spaceCode, startDate, endDate),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached budgets", error);
    return undefined;
  }
};
