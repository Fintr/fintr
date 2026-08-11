"use client";

import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { comboboxInputClassName } from "@/components/ui/combobox";
import { TagChip } from "@/components/ui/tag-chip";
import type { TransactionTag } from "@/types/transactionTagTypes";

export interface TagFilterComboBoxProps {
  tags: TransactionTag[];
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  showAllOnFocus?: boolean;
  /** `banner` = full-width rows with large image preview (forms). */
  chipVariant?: "compact" | "full" | "banner";
}

export const TagFilterComboBox = ({
  tags,
  values = [],
  onValuesChange,
  placeholder = "Select tags",
  className,
  popoverClassName,
  disabled = false,
  showAllOnFocus = true,
  chipVariant = "full",
}: TagFilterComboBoxProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const options = useMemo(
    () =>
      tags.map((tag) => ({
        value: tag.id,
        label: tag.name,
        tag,
      })),
    [tags],
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
      {values.length > 0 && (
        <div
          className={cn(
            chipVariant === "banner"
              ? "flex flex-col gap-2"
              : "flex flex-wrap gap-2",
          )}
        >
          {values.map((value) => {
            const tag = tags.find((item) => item.id === value);
            if (!tag) {
              return null;
            }

            if (chipVariant === "banner") {
              return (
                <div key={value} className="relative w-full">
                  <TagChip tag={tag} variant="banner" />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${tag.name}`}
                    onClick={() => handleRemove(value)}
                  >
                    <span className="sr-only">Remove</span>
                    ×
                  </button>
                </div>
              );
            }

            return (
              <span key={value} className="inline-flex max-w-full items-center gap-1">
                <TagChip tag={tag} variant={chipVariant} />
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => handleRemove(value)}
                >
                  <span className="sr-only">Remove</span>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

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
            className,
          )}
          disabled={disabled}
          onClick={() => setOpen(true)}
        />
        <Ariakit.ComboboxPopover
          className={cn(
            "z-50 max-h-60 w-[var(--popover-anchor-width)] overflow-auto rounded-md border bg-popover p-1 shadow-md",
            popoverClassName,
          )}
          gutter={4}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No tags found
            </div>
          ) : (
            filteredOptions.map((option) => (
              <Ariakit.ComboboxItem
                key={option.value}
                value={option.value}
                setValueOnClick={false}
                hideOnClick={false}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "cursor-pointer rounded-sm outline-none data-[active-item]:bg-accent",
                  chipVariant === "banner"
                    ? "px-2 py-2"
                    : "flex items-center gap-2 px-2 py-1.5 text-sm",
                )}
              >
                <TagChip
                  tag={option.tag}
                  variant={chipVariant}
                  className={chipVariant === "banner" ? "w-full" : undefined}
                />
              </Ariakit.ComboboxItem>
            ))
          )}
        </Ariakit.ComboboxPopover>
      </Ariakit.ComboboxProvider>
    </div>
  );
};
