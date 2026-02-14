"use client";

import React, { useMemo } from "react";
import { ComboBox } from "@/components/ui/combobox";
import {
  CURRENCIES,
  getCountryCodeForCurrency,
  getFlagEmoji,
} from "@/data/currencies";

const FLAG_NAME_GAP = "\u2002\u2002"; // en spaces between flag and name

export interface CurrencyPickerProps {
  /** Current value: 3-letter ISO currency code (e.g. "PHP", "USD"). */
  value: string;
  /** Called when user selects a currency; receives the 3-letter code. */
  onChange: (currencyCode: string) => void;
  /** Label above the picker (e.g. "Currency"). */
  label?: string;
  /** Placeholder when empty. */
  placeholder?: string;
  /** Extra class names for the input. */
  className?: string;
  /** Disable the picker. */
  disabled?: boolean;
}

/**
 * Reusable searchable currency picker with flags and full names.
 * Uses the full ISO 4217 list from @/data/currencies; search is client-side.
 * Use in onboarding, settings, or any form (e.g. CURRENCIES1 flow).
 */
export function CurrencyPicker({
  value,
  onChange,
  label = "Currency",
  placeholder = "Search by name or code (e.g. PHP, US Dollar)...",
  className,
  disabled = false,
}: CurrencyPickerProps) {
  const currencyOptions = useMemo(
    () =>
      CURRENCIES.map(({ code, name }) => {
        const flag = getFlagEmoji(getCountryCodeForCurrency(code));
        return {
          label: flag
            ? `${flag}${FLAG_NAME_GAP}${name} (${code})`
            : `${name} (${code})`,
          value: code,
        };
      }),
    []
  );

  return (
    <ComboBox
      filterType="frontend"
      data={currencyOptions}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      minSearchLength={1}
      showAllOnFocus
      className={className}
      disabled={disabled}
      maxVisibleOptions={5}
      getDisplayLabel={(code) =>
        currencyOptions.find((o) => o.value === code)?.label ?? code
      }
    />
  );
}
