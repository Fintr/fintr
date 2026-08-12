"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LoanListFilter = "all" | "borrowed" | "lent" | "paid_off";

type LoanListFilterProps = {
  value: LoanListFilter;
  onChange: (value: LoanListFilter) => void;
};

export function LoanListFilter({ value, onChange }: LoanListFilterProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as LoanListFilter)}
    >
      <TabsList className="grid h-auto w-full grid-cols-4 bg-white dark:bg-card dark:shadow-sm">
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          All
        </TabsTrigger>
        <TabsTrigger value="borrowed" className="text-xs sm:text-sm">
          Borrowed
        </TabsTrigger>
        <TabsTrigger value="lent" className="text-xs sm:text-sm">
          Lent
        </TabsTrigger>
        <TabsTrigger value="paid_off" className="text-xs sm:text-sm">
          Paid off
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export const loanListFilterEmptyMessage = (
  filter: LoanListFilter,
): string => {
  switch (filter) {
    case "borrowed":
      return "No borrowed loans";
    case "lent":
      return "No lent loans";
    case "paid_off":
      return "No completed loans";
    default:
      return "No loans yet";
  }
};
