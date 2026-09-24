"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencySelectorSheet } from "@/components/ui/currency-selector-sheet";
import { CurrencyFlag } from "@/components/ui/currency-flag";
import { cn } from "@/lib/utils";
import { CURRENCIES } from "@/data/currencies";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";

export interface CurrencyPickerProps {
  /** Current value: 3-letter ISO currency code (e.g. "PHP", "USD"). */
  value: string;
  /** Called when user selects a currency; receives the 3-letter code. */
  onChange: (currencyCode: string) => void;
  /** Label above the picker (e.g. "Currency"). */
  label?: string;
  /** Placeholder when empty. */
  placeholder?: string;
  /** Extra class names for the trigger. */
  className?: string;
  /** Disable the picker. */
  disabled?: boolean;
}

/**
 * Reusable searchable currency picker with flags and full names.
 * Opens a bottom sheet (mobile) or popover (desktop) with search and popular-first sort.
 */
export function CurrencyPicker({
  value,
  onChange,
  label = "Currency",
  placeholder = "Select currency",
  className,
  disabled = false,
}: CurrencyPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedCurrency = useMemo(
    () => CURRENCIES.find((currency) => currency.code === value),
    [value],
  );

  const displayLabel = useMemo(() => {
    if (!selectedCurrency) {
      return placeholder;
    }

    return (
      <span className="flex min-w-0 items-center gap-2">
        <CurrencyFlag currencyCode={selectedCurrency.code} size={20} />
        <span className="truncate">
          {selectedCurrency.name} ({selectedCurrency.code})
        </span>
      </span>
    );
  }, [placeholder, selectedCurrency]);

  return (
    <div className="space-y-2">
      {label ? (
        <Label className="text-sm leading-none">{label}</Label>
      ) : null}
      <CurrencySelectorSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        onSelect={onChange}
        trigger={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between px-3 font-normal",
              formControlInteractiveSurfaceClassName,
              !selectedCurrency && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
    </div>
  );
}
