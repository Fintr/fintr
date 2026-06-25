"use client";

import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { comboboxInputClassName } from "@/components/ui/combobox";
import { FilterSelectionPill, FilterSelectionPills } from "@/components/ui/filter-selection-pills";
import { OptionType } from "@/types/generalTypes";

export interface AccountFilterComboBoxProps {
  options: OptionType[];
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
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
  className,
  popoverClassName,
  disabled = false,
  showAllOnFocus = true,
}: AccountFilterComboBoxProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const pills = useMemo(
    (): FilterSelectionPill[] =>
      values.map((value) => ({
        value,
        label: options.find((option) => option.value === value)?.label ?? value,
      })),
    [options, values],
  );

  const filteredOptions = useMemo(() => {
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
  }, [options, searchValue, open, showAllOnFocus, selectedSet]);

  const isOptionValue = useCallback(
    (nextValue: string) =>
      options.some((option) => option.value === nextValue),
    [options],
  );

  const handleComboboxValueChange = (nextValue: string) => {
    startTransition(() => {
      setSearchValue(isOptionValue(nextValue) ? "" : nextValue);
    });
  };

  const handleSelect = (value: string) => {
    if (selectedSet.has(value)) {
      return;
    }

    onValuesChange?.([...values, value]);
    setSearchValue("");
  };

  const handleRemove = (value: string) => {
    onValuesChange?.(values.filter((current) => current !== value));
  };

  return (
    <div className="space-y-2">
      <FilterSelectionPills selections={pills} onRemove={handleRemove} />

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
                setValueOnClick={false}
                hideOnClick={false}
                className="relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground"
                onClick={() => handleSelect(option.value)}
              >
                <span className="w-full px-2 py-1 rounded-sm hover:bg-accent">
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

export default AccountFilterComboBox;
