import { describe, expect, it } from "vitest";
import {
  ensureLockedCategoryInTreeOptions,
  EXPENSE_ADJUSTMENT_CATEGORY_NAME,
  INCOME_ADJUSTMENT_CATEGORY_NAME,
  isLockedExpenseCategoryName,
  isLockedIncomeCategoryName,
  lockedCategoryRefForExpenseEdit,
  lockedCategoryRefForIncomeEdit,
  TRANSFER_FEE_CATEGORY_NAME,
} from "./lockedSystemCategories";

const CATEGORY_ID = "2ce68847-fd98-4239-92cf-805f49cd8c31";

describe("lockedSystemCategories", () => {
  it("identifies locked expense category names", () => {
    expect(isLockedExpenseCategoryName(EXPENSE_ADJUSTMENT_CATEGORY_NAME)).toBe(
      true,
    );
    expect(isLockedExpenseCategoryName(TRANSFER_FEE_CATEGORY_NAME)).toBe(true);
    expect(isLockedExpenseCategoryName("Food")).toBe(false);
  });

  it("identifies locked income category names", () => {
    expect(isLockedIncomeCategoryName(INCOME_ADJUSTMENT_CATEGORY_NAME)).toBe(
      true,
    );
    expect(isLockedIncomeCategoryName("Salary")).toBe(false);
  });

  it("injects locked categories into tree options when missing", () => {
    const options = ensureLockedCategoryInTreeOptions([], {
      id: CATEGORY_ID,
      name: EXPENSE_ADJUSTMENT_CATEGORY_NAME,
    });

    expect(options).toHaveLength(1);
    expect(options[0]?.name).toBe(EXPENSE_ADJUSTMENT_CATEGORY_NAME);
    expect(options[0]?.id).toBe(CATEGORY_ID);
  });

  it("returns locked ref only in edit mode for adjustment transactions", () => {
    expect(
      lockedCategoryRefForExpenseEdit(
        true,
        EXPENSE_ADJUSTMENT_CATEGORY_NAME,
        CATEGORY_ID,
      ),
    ).toEqual({
      id: CATEGORY_ID,
      name: EXPENSE_ADJUSTMENT_CATEGORY_NAME,
    });

    expect(
      lockedCategoryRefForExpenseEdit(
        false,
        EXPENSE_ADJUSTMENT_CATEGORY_NAME,
        CATEGORY_ID,
      ),
    ).toBeNull();

    expect(
      lockedCategoryRefForIncomeEdit(
        true,
        INCOME_ADJUSTMENT_CATEGORY_NAME,
        CATEGORY_ID,
      ),
    ).toEqual({
      id: CATEGORY_ID,
      name: INCOME_ADJUSTMENT_CATEGORY_NAME,
    });
  });
});
