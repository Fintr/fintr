"use client";

import { matchSorter } from "match-sorter";
import { useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FilterPickerItem,
  FilterPickerShell,
} from "@/components/ui/filter-picker-shell";
import {
  FilterSelectionPill,
  FilterSelectionPills,
} from "@/components/ui/filter-selection-pills";
import {
  CategoryTreeOption,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import {
  buildCategoryFilterOptions,
  CategoryFilterOption,
  areAllExpenseCategoriesSelected,
  areAllIncomeCategoriesSelected,
  collectSelectedParentCategoryIds,
  EXPENSE_SECTION_VALUE,
  expandExpenseCategorySelection,
  expandIncomeCategorySelection,
  getCategoryFilterDisplayLabel,
  INCOME_SECTION_VALUE,
  isCategoryFilterSectionValue,
  isCategoryOptionCoveredByParentSelection,
  isExpenseCategoryFilterValue,
  isIncomeCategoryFilterValue,
  removeSubcategoriesForParent,
} from "@/utils/categoryFilterOptions";

const ALL_CATEGORIES_VALUE = "__all_categories__";

export interface CategoryFilterComboBoxProps {
  expenseOptions: CategoryTreeOption[];
  incomeOptions: CategoryTreeOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  showAllOnFocus?: boolean;
}

export const CategoryFilterComboBox = ({
  expenseOptions,
  incomeOptions,
  placeholder,
  searchPlaceholder = "Search categories",
  value,
  onChange,
  multiple = false,
  values = [],
  onValuesChange,
  className,
  popoverClassName,
  disabled = false,
  showAllOnFocus = true,
}: CategoryFilterComboBoxProps) => {
  const closedPlaceholder =
    placeholder ?? (multiple ? "Select categories" : "All categories");

  const allOptions = useMemo(
    () => buildCategoryFilterOptions(expenseOptions, incomeOptions),
    [expenseOptions, incomeOptions],
  );

  const resolveDisplayLabel = useCallback(
    (pickerValue: string) =>
      getCategoryFilterDisplayLabel(
        pickerValue,
        expenseOptions,
        incomeOptions,
      ),
    [expenseOptions, incomeOptions],
  );

  const selectedSet = useMemo(
    () => new Set(multiple ? values : []),
    [multiple, values],
  );

  const selectedParentCategoryIds = useMemo(
    () => (multiple ? collectSelectedParentCategoryIds(values) : new Set<string>()),
    [multiple, values],
  );

  const hasSelectedValue =
    !multiple && Boolean(value) && value !== "all";

  const selectedLabel = hasSelectedValue
    ? resolveDisplayLabel(value as string)
    : "";

  const isOptionAvailable = useCallback(
    (option: CategoryFilterOption) => {
      if (option.disabled) {
        return true;
      }

      if (option.sectionHeader) {
        if (!multiple) {
          return true;
        }

        if (option.value === EXPENSE_SECTION_VALUE) {
          return !areAllExpenseCategoriesSelected(values, expenseOptions);
        }

        if (option.value === INCOME_SECTION_VALUE) {
          return !areAllIncomeCategoriesSelected(values, incomeOptions);
        }
      }

      if (multiple && selectedSet.has(option.value)) {
        return false;
      }

      if (
        multiple
        && isCategoryOptionCoveredByParentSelection(
          option.value,
          selectedParentCategoryIds,
        )
      ) {
        return false;
      }

      return true;
    },
    [
      multiple,
      selectedSet,
      selectedParentCategoryIds,
      values,
      expenseOptions,
      incomeOptions,
    ],
  );

  const pills = useMemo(
    (): FilterSelectionPill[] =>
      values.map((pickerValue) => ({
        value: pickerValue,
        label: resolveDisplayLabel(pickerValue),
        variant: isIncomeCategoryFilterValue(pickerValue, incomeOptions)
          ? "income"
          : isExpenseCategoryFilterValue(pickerValue, expenseOptions)
            ? "expense"
            : "default",
      })),
    [resolveDisplayLabel, values, expenseOptions, incomeOptions],
  );

  useEffect(() => {
    if (!multiple || !onValuesChange) {
      return;
    }

    const parentIds = collectSelectedParentCategoryIds(values);
    const normalized = values.filter(
      (current) => !isCategoryOptionCoveredByParentSelection(current, parentIds),
    );

    if (normalized.length !== values.length) {
      onValuesChange(normalized);
    }
  }, [values, multiple, onValuesChange]);

  const getFilteredOptions = (searchValue: string, open: boolean) => {
    const selectable = allOptions.filter(
      (option) => !option.disabled && isOptionAvailable(option),
    );

    if (showAllOnFocus && open && searchValue.length === 0) {
      return allOptions.filter((option) => isOptionAvailable(option));
    }

    if (searchValue.length === 0) {
      return allOptions.filter((option) => isOptionAvailable(option));
    }

    const matched = matchSorter(selectable, searchValue, {
      keys: ["label", "value"],
    });
    const matchedValues = new Set(matched.map((option) => option.value));
    const result: CategoryFilterOption[] = [];
    let currentSection: CategoryFilterOption | null = null;

    for (const option of allOptions) {
      if (option.sectionHeader) {
        currentSection = option;
        continue;
      }

      if (!matchedValues.has(option.value) || !isOptionAvailable(option)) {
        continue;
      }

      if (
        currentSection
        && isOptionAvailable(currentSection)
        && !result.includes(currentSection)
      ) {
        result.push(currentSection);
      }

      result.push(option);
    }

    return result;
  };

  const handleSingleSelect = (option: CategoryFilterOption) => {
    if (option.disabled || option.sectionHeader) {
      return;
    }

    if (option.value === ALL_CATEGORIES_VALUE) {
      onChange?.("");
      return;
    }

    onChange?.(option.value);
  };

  const handleMultiSelect = (option: CategoryFilterOption) => {
    if (option.disabled) {
      return;
    }

    if (selectedSet.has(option.value)) {
      return;
    }

    if (isCategoryFilterSectionValue(option.value)) {
      const nextValues =
        option.value === EXPENSE_SECTION_VALUE
          ? expandExpenseCategorySelection(values, expenseOptions)
          : expandIncomeCategorySelection(values, incomeOptions);

      onValuesChange?.(nextValues);
      return;
    }

    const assignment = parseCategoryPickerValue(option.value);
    const nextValues =
      assignment && !assignment.subcategoryId
        ? [
            ...removeSubcategoriesForParent(values, assignment.categoryId),
            option.value,
          ]
        : [...values, option.value];

    onValuesChange?.(nextValues);
  };

  const handleRemove = (pickerValue: string) => {
    onValuesChange?.(values.filter((current) => current !== pickerValue));
  };

  const showAllOption = (searchValue: string) => {
    if (!hasSelectedValue) {
      return false;
    }

    if (searchValue.length === 0) {
      return true;
    }

    return matchSorter([{ label: "All categories" }], searchValue, {
      keys: ["label"],
    }).length > 0;
  };

  return (
    <div className="space-y-2">
      {multiple ? (
        <FilterSelectionPills selections={pills} onRemove={handleRemove} />
      ) : null}

      <FilterPickerShell
        placeholder={closedPlaceholder}
        searchPlaceholder={searchPlaceholder}
        triggerLabel={selectedLabel}
        hasValue={hasSelectedValue}
        onClear={
          hasSelectedValue
            ? () => onChange?.("")
            : undefined
        }
        clearAriaLabel="Clear category"
        disabled={disabled}
        className={className}
        popoverClassName={popoverClassName}
      >
        {({ searchValue, open }) => {
          const filteredOptions = getFilteredOptions(searchValue, open);

          return (
            <>
              {showAllOption(searchValue) ? (
                <FilterPickerItem
                  value={ALL_CATEGORIES_VALUE}
                  setValueOnClick={false}
                  hideOnClick
                  className="relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none data-[active-item]:bg-accent"
                  onClick={() =>
                    handleSingleSelect({
                      label: "All categories",
                      value: ALL_CATEGORIES_VALUE,
                    })
                  }
                >
                  <span className="w-full px-2 py-1.5 rounded-sm">
                    All categories
                  </span>
                </FilterPickerItem>
              ) : null}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  if (option.sectionHeader && !multiple) {
                    return (
                      <div
                        key={option.value}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {option.label}
                      </div>
                    );
                  }

                  return (
                    <FilterPickerItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      setValueOnClick={false}
                      hideOnClick={!multiple}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground data-[disabled]:pointer-events-none",
                        option.sectionHeader
                          ? "text-muted-foreground font-semibold uppercase tracking-wide text-xs py-2"
                          : "data-[disabled]:opacity-50",
                      )}
                      onClick={() =>
                        multiple
                          ? handleMultiSelect(option)
                          : handleSingleSelect(option)
                      }
                    >
                      <span
                        className={cn(
                          "w-full px-2 py-1 rounded-sm",
                          !option.disabled && "hover:bg-accent",
                          option.sectionHeader
                            && "font-semibold uppercase tracking-wide text-xs",
                          option.indentLevel === 1 && "pl-6",
                        )}
                      >
                        {option.label}
                      </span>
                    </FilterPickerItem>
                  );
                })
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              )}
            </>
          );
        }}
      </FilterPickerShell>
    </div>
  );
};

export default CategoryFilterComboBox;
