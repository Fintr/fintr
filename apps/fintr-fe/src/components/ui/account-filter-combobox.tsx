"use client";

import { matchSorter } from "match-sorter";
import { useMemo } from "react";
import {
  FilterPickerItem,
  FilterPickerShell,
} from "@/components/ui/filter-picker-shell";
import { FilterSelectionPill, FilterSelectionPills } from "@/components/ui/filter-selection-pills";
import { OptionType } from "@/types/generalTypes";

export interface AccountFilterComboBoxProps {
  options: OptionType[];
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  showAllOnFocus?: boolean;
}

export const AccountFilterComboBox = ({
  options,
  values = [],
  onValuesChange,
  placeholder = "Select accounts",
  searchPlaceholder = "Search accounts",
  className,
  popoverClassName,
  disabled = false,
  showAllOnFocus = true,
}: AccountFilterComboBoxProps) => {
  const selectedSet = useMemo(() => new Set(values), [values]);

  const pills = useMemo(
    (): FilterSelectionPill[] =>
      values.map((value) => ({
        value,
        label: options.find((option) => option.value === value)?.label ?? value,
      })),
    [options, values],
  );

  const getFilteredOptions = (searchValue: string, open: boolean) => {
    const selectable = options.filter((option) => !selectedSet.has(option.value));

    if (showAllOnFocus && open && searchValue.length === 0) {
      return selectable;
    }

    if (searchValue.length === 0) {
      return selectable;
    }

    return matchSorter(selectable, searchValue, {
      keys: ["label", "value"],
    });
  };

  const handleSelect = (value: string) => {
    if (selectedSet.has(value)) {
      return;
    }

    onValuesChange?.([...values, value]);
  };

  const handleRemove = (value: string) => {
    onValuesChange?.(values.filter((current) => current !== value));
  };

  return (
    <div className="space-y-2">
      <FilterSelectionPills selections={pills} onRemove={handleRemove} />

      <FilterPickerShell
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        disabled={disabled}
        className={className}
        popoverClassName={popoverClassName}
      >
        {({ searchValue, open }) => {
          const filteredOptions = getFilteredOptions(searchValue, open);

          if (filteredOptions.length === 0) {
            return (
              <div className="p-2 text-center text-sm text-muted-foreground">
                No results found
              </div>
            );
          }

          return filteredOptions.map((option) => (
            <FilterPickerItem
              key={option.value}
              value={option.value}
              setValueOnClick={false}
              hideOnClick={false}
              className="relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none data-[active-item]:bg-accent"
              onClick={() => handleSelect(option.value)}
            >
              <span className="w-full px-2 py-1 rounded-sm hover:bg-accent">
                {option.label}
              </span>
            </FilterPickerItem>
          ));
        }}
      </FilterPickerShell>
    </div>
  );
};

export default AccountFilterComboBox;
