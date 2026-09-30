"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const BudgetTotalSpentInfo = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex text-primary/70 hover:text-primary"
        aria-label="About total spent"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-4">
      <h4 className="mb-1 text-sm font-semibold text-primary">
        Total spent
      </h4>
      <p className="text-sm text-muted-foreground">
        This total only counts spending in categories that have a budget.
      </p>
    </PopoverContent>
  </Popover>
);
