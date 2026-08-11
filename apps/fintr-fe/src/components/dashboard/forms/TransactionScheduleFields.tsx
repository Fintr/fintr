"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import {
  FilterOptionPills,
  type FilterOptionPill,
} from "@/components/ui/filter-option-pills";
import { REPEAT_INTERVALS, ScheduleTypeEnum } from "@/constants/transactionConstants";
import { cn } from "@/lib/utils";

type ScheduleTypeOption = {
  label: string;
  value: ScheduleTypeEnum;
};

type TransactionScheduleFieldsProps = {
  scheduleType: ScheduleTypeEnum;
  onScheduleTypeChange: (value: ScheduleTypeEnum) => void;
  scheduleTypeOptions: readonly ScheduleTypeOption[];
  repeatInterval?: string;
  onRepeatIntervalChange?: (value: string) => void;
  showRepeatInterval?: boolean;
  scheduleTypeErrors?: string[];
  repeatIntervalErrors?: string[];
  scheduleTypeId?: string;
  repeatIntervalId?: string;
  className?: string;
  children?: ReactNode;
};

const repeatIntervalOptions: FilterOptionPill[] = REPEAT_INTERVALS.map((interval) => ({
  value: interval.value,
  label: interval.label,
}));

export const TransactionScheduleFields = ({
  scheduleType,
  onScheduleTypeChange,
  scheduleTypeOptions,
  repeatInterval = "",
  onRepeatIntervalChange,
  showRepeatInterval = false,
  scheduleTypeErrors,
  repeatIntervalErrors,
  scheduleTypeId = "scheduleType",
  repeatIntervalId = "repeatInterval",
  className,
  children,
}: TransactionScheduleFieldsProps) => {
  const scheduleTypePillOptions: FilterOptionPill[] = scheduleTypeOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <div className={cn("space-y-3 min-w-0", className)}>
      <div className="space-y-2">
        <Label htmlFor={scheduleTypeId} className="text-sm">
          Schedule Type
        </Label>
        <FilterOptionPills
          id={scheduleTypeId}
          ariaLabel="Schedule type"
          value={scheduleType}
          onChange={(value) => onScheduleTypeChange(value as ScheduleTypeEnum)}
          options={scheduleTypePillOptions}
        />
        {scheduleTypeErrors?.map((error) => (
          <FormError key={error}>{error}</FormError>
        ))}
      </div>

      {showRepeatInterval ? (
        <div className="space-y-2">
          <Label htmlFor={repeatIntervalId} className="text-sm">
            Repeat Interval
          </Label>
          <FilterOptionPills
            id={repeatIntervalId}
            ariaLabel="Repeat interval"
            value={repeatInterval}
            onChange={(value) => onRepeatIntervalChange?.(value)}
            options={repeatIntervalOptions}
          />
          {repeatIntervalErrors?.map((error) => (
            <FormError key={error}>{error}</FormError>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  );
};

export default TransactionScheduleFields;
