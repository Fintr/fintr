"use client";

import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useCallback, useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { comboboxInputClassName } from "@/components/ui/combobox";
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
  collectSelectedParentCategoryIds,
  getCategoryFilterDisplayLabel,
  isCategoryFilterSectionValue,
  isCategoryOptionCoveredByParentSelection,
  removeSubcategoriesForParent,
} from "@/utils/categoryFilterOptions";

export interface CategoryFilterComboBoxProps {
  expenseOptions: CategoryTreeOption[];
  incomeOptions: CategoryTreeOption[];
  placeholder?: string;
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
  placeholder = "Select categories",
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

  const [searchValue, setSearchValue] = useState(
    () => (!multiple && value ? resolveDisplayLabel(value) : ""),
  );
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(
    () => new Set(multiple ? values : []),
    [multiple, values],
  );

  const selectedParentCategoryIds = useMemo(
    () => (multiple ? collectSelectedParentCategoryIds(values) : new Set<string>()),
    [multiple, values],
  );

  const isOptionAvailable = useCallback(
    (option: CategoryFilterOption) => {
      if (option.disabled) {
        return true;
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
    [multiple, selectedSet, selectedParentCategoryIds],
  );

  const pills = useMemo(
    (): FilterSelectionPill[] =>
      values.map((pickerValue) => ({
        value: pickerValue,
        label: resolveDisplayLabel(pickerValue),
      })),
    [resolveDisplayLabel, values],
  );

  useEffect(() => {
    if (!multiple || !onValuesChange) {
      return;
    }

    const parentIds = collectSelectedParentCategoryIds(values);
    const normalized = values.filter(
      (value) => !isCategoryOptionCoveredByParentSelection(value, parentIds),
    );

    if (normalized.length !== values.length) {
      onValuesChange(normalized);
    }
  }, [values, multiple, onValuesChange]);

  useEffect(() => {
    if (multiple || open) {
      return;
    }

    if (value !== undefined && value !== null) {
      setSearchValue(
        value === "all" || value === ""
          ? ""
          : resolveDisplayLabel(value),
      );
    }
  }, [value, open, resolveDisplayLabel, multiple]);

  const prevOpen = useRef(open);
  useEffect(() => {
    if (multiple || !open || !prevOpen.current) {
      prevOpen.current = open;
      return;
    }

    if (value != null && value !== "all") {
      setSearchValue(resolveDisplayLabel(value));
    }

    prevOpen.current = open;
  }, [open, value, resolveDisplayLabel, multiple]);

  const filteredOptions = useMemo(() => {
    const selectable = allOptions.filter(
      (option) => !option.disabled && isOptionAvailable(option),
    );

    if (showAllOnFocus && open && searchValue.length === 0) {
      return allOptions.filter(
        (option) => option.disabled || isOptionAvailable(option),
      );
    }

    const matched = matchSorter(selectable, searchValue, {
      keys: ["label", "value"],
    });

    if (searchValue.length === 0) {
      return allOptions.filter(
        (option) => option.disabled || isOptionAvailable(option),
      );
    }

    const matchedValues = new Set(matched.map((option) => option.value));
    const result: CategoryFilterOption[] = [];
    let currentSection: CategoryFilterOption | null = null;

    for (const option of allOptions) {
      if (option.disabled) {
        currentSection = option;
        continue;
      }

      if (!matchedValues.has(option.value)) {
        continue;
      }

      if (!isOptionAvailable(option)) {
        continue;
      }

      if (currentSection && !result.includes(currentSection)) {
        result.push(currentSection);
      }

      result.push(option);
    }

    return result;
  }, [
    allOptions,
    searchValue,
    open,
    showAllOnFocus,
    isOptionAvailable,
  ]);

  const handleSingleChange = (nextValue: string) => {
    setSearchValue(nextValue);
    onChange?.(nextValue);
  };

  const isSelectableOptionValue = useCallback(
    (nextValue: string) =>
      allOptions.some(
        (option) =>
          !option.disabled
          && !isCategoryFilterSectionValue(option.value)
          && option.value === nextValue,
      ),
    [allOptions],
  );

  const handleComboboxValueChange = (nextValue: string) => {
    if (multiple) {
      startTransition(() => {
        setSearchValue(isSelectableOptionValue(nextValue) ? "" : nextValue);
      });
      return;
    }

    startTransition(() => handleSingleChange(nextValue));
  };

  const handleSingleSelect = (option: CategoryFilterOption) => {
    if (option.disabled || isCategoryFilterSectionValue(option.value)) {
      return;
    }

    setSearchValue(resolveDisplayLabel(option.value));
    onChange?.(option.value);
    setOpen(false);
  };

  const handleMultiSelect = (option: CategoryFilterOption) => {
    if (option.disabled || isCategoryFilterSectionValue(option.value)) {
      return;
    }

    if (selectedSet.has(option.value)) {
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
    setSearchValue("");
  };

  const handleRemove = (pickerValue: string) => {
    onValuesChange?.(values.filter((current) => current !== pickerValue));
  };

  return (
    <div className="space-y-2">
      {multiple ? (
        <FilterSelectionPills selections={pills} onRemove={handleRemove} />
      ) : null}

      <Ariakit.ComboboxProvider
        setValue={handleComboboxValueChange}
        value={searchValue}
        open={open}
        setOpen={setOpen}
      >
        <Ariakit.Combobox
          placeholder={placeholder}
          className={cn(
            comboboxInputClassName,
            disabled && "cursor-not-allowed bg-gray-100 dark:bg-muted/50",
            className,
          )}
          disabled={disabled}
          onClick={() => setOpen(true)}
        />
        <Ariakit.ComboboxPopover
          gutter={8}
          sameWidth
          className={cn(
            "relative z-[100] max-h-96 min-w-[8rem] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 py-1",
            popoverClassName,
          )}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <Ariakit.ComboboxItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                setValueOnClick={!multiple}
                hideOnClick={!multiple}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground data-[disabled]:pointer-events-none",
                  option.disabled
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
                    option.indentLevel === 1 && "pl-6",
                  )}
                >
                  {option.label}
                </span>
              </Ariakit.ComboboxItem>
            ))
          ) : (
            <div className="p-2 text-center text-gray-300 text-sm">
              No results found
            </div>
          )}
        </Ariakit.ComboboxPopover>
      </Ariakit.ComboboxProvider>
    </div>
  );
};

export default CategoryFilterComboBox;
