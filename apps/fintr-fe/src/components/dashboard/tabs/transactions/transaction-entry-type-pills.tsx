"use client";

import { FilterOptionPills } from "@/components/ui/filter-option-pills";
import {
  TRANSACTION_ENTRY_TYPE_FILTER_OPTIONS,
  type TransactionEntryTypeFilter,
} from "@/utils/transactionEntryTypeFilter";

type TransactionEntryTypePillsProps = {
  value: TransactionEntryTypeFilter;
  onChange: (value: TransactionEntryTypeFilter) => void;
  className?: string;
};

export const TransactionEntryTypePills = ({
  value,
  onChange,
  className,
}: TransactionEntryTypePillsProps) => {
  return (
    <FilterOptionPills
      options={TRANSACTION_ENTRY_TYPE_FILTER_OPTIONS}
      value={value}
      onChange={(nextValue) => onChange(nextValue as TransactionEntryTypeFilter)}
      ariaLabel="Filter transactions by type"
      scrollable
      className={className}
    />
  );
};

export default TransactionEntryTypePills;
