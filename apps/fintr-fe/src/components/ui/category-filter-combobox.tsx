import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useCallback, useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { comboboxInputClassName } from "@/components/ui/combobox";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import {
  buildCategoryFilterOptions,
  CategoryFilterOption,
  getCategoryFilterDisplayLabel,
  isCategoryFilterSectionValue,
} from "@/utils/categoryFilterOptions";

export interface CategoryFilterComboBoxProps {
  expenseOptions: CategoryTreeOption[];
  incomeOptions: CategoryTreeOption[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
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
    () => (value ? resolveDisplayLabel(value) : ""),
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open && value !== undefined && value !== null) {
      setSearchValue(
        value === "all" || value === ""
          ? ""
          : resolveDisplayLabel(value),
      );
    }
  }, [value, open, resolveDisplayLabel]);

  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current && value != null && value !== "all") {
      setSearchValue(resolveDisplayLabel(value));
    }
    prevOpen.current = open;
  }, [open, value, resolveDisplayLabel]);

  const filteredOptions = useMemo(() => {
    if (showAllOnFocus && open && searchValue.length === 0) {
      return allOptions;
    }

    const selectable = allOptions.filter((option) => !option.disabled);
    const matched = matchSorter(selectable, searchValue, {
      keys: ["label", "value"],
    });

    if (searchValue.length === 0) {
      return allOptions;
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

      if (currentSection && !result.includes(currentSection)) {
        result.push(currentSection);
      }

      result.push(option);
    }

    return result;
  }, [allOptions, searchValue, open, showAllOnFocus]);

  const handleChange = (nextValue: string) => {
    setSearchValue(nextValue);
    onChange?.(nextValue);
  };

  const handleSelect = (option: CategoryFilterOption) => {
    if (option.disabled || isCategoryFilterSectionValue(option.value)) {
      return;
    }

    setSearchValue(resolveDisplayLabel(option.value));
    onChange?.(option.value);
    setOpen(false);
  };

  return (
    <Ariakit.ComboboxProvider
      setValue={(nextValue) => {
        startTransition(() => handleChange(nextValue));
      }}
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
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground data-[disabled]:pointer-events-none",
                option.disabled
                  ? "text-muted-foreground font-semibold uppercase tracking-wide text-xs py-2"
                  : "data-[disabled]:opacity-50",
              )}
              onClick={() => handleSelect(option)}
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
  );
};

export default CategoryFilterComboBox;
