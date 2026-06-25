import {
  CategoryTreeOption,
  formatCategoryPickerValue,
  getCategoryDisplayLabel,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { OptionType } from "@/types/generalTypes";

export const EXPENSE_SECTION_VALUE = "__section_expense__";
export const INCOME_SECTION_VALUE = "__section_income__";

export interface CategoryFilterOption extends OptionType {
  disabled?: boolean;
  indentLevel?: number;
}

const appendCategoryGroup = (
  result: CategoryFilterOption[],
  sectionLabel: string,
  sectionValue: string,
  trees: CategoryTreeOption[],
): void => {
  if (trees.length === 0) {
    return;
  }

  result.push({
    label: sectionLabel,
    value: sectionValue,
    disabled: true,
  });

  for (const parent of trees) {
    result.push({
      label: parent.label,
      value: formatCategoryPickerValue({
        categoryId: parent.id,
        subcategoryId: null,
      }),
    });

    for (const child of parent.children ?? []) {
      result.push({
        label: child.label,
        value: formatCategoryPickerValue({
          categoryId: parent.id,
          subcategoryId: child.id,
        }),
        indentLevel: 1,
      });
    }
  }
};

export const buildCategoryFilterOptions = (
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[],
): CategoryFilterOption[] => {
  const result: CategoryFilterOption[] = [];

  appendCategoryGroup(
    result,
    "Expense",
    EXPENSE_SECTION_VALUE,
    expenseOptions,
  );
  appendCategoryGroup(
    result,
    "Income",
    INCOME_SECTION_VALUE,
    incomeOptions,
  );

  return result;
};

export const getCategoryFilterDisplayLabel = (
  value: string,
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[],
): string => {
  if (!value || value === "all") {
    return "";
  }

  return getCategoryDisplayLabel(value, [
    ...expenseOptions,
    ...incomeOptions,
  ]);
};

export const isCategoryFilterSectionValue = (value: string): boolean =>
  value === EXPENSE_SECTION_VALUE || value === INCOME_SECTION_VALUE;

export const collectSelectedParentCategoryIds = (
  values: string[],
): Set<string> => {
  const parentIds = new Set<string>();

  for (const value of values) {
    const assignment = parseCategoryPickerValue(value);

    if (assignment && !assignment.subcategoryId) {
      parentIds.add(assignment.categoryId);
    }
  }

  return parentIds;
};

export const isCategoryOptionCoveredByParentSelection = (
  optionValue: string,
  selectedParentCategoryIds: Set<string>,
): boolean => {
  const assignment = parseCategoryPickerValue(optionValue);

  if (!assignment?.subcategoryId) {
    return false;
  }

  return selectedParentCategoryIds.has(assignment.categoryId);
};

export const removeSubcategoriesForParent = (
  values: string[],
  parentCategoryId: string,
): string[] =>
  values.filter((value) => {
    const assignment = parseCategoryPickerValue(value);

    return !(
      assignment?.categoryId === parentCategoryId
      && assignment.subcategoryId
    );
  });
