"use client";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FilterOptionPills } from "@/components/ui/filter-option-pills";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DATE_FILTER_PRESETS,
  DATE_FILTER_RELATIVE_PRESETS,
  DATE_FILTER_TYPE_OPTIONS,
  DateFilterPresetId,
  DateFilterTypeSelector,
  getDateFilterPresetLabel,
  isRelativeDateFilterPreset,
} from "@/utils/dateFilterPresets";
import { getYearOptions, monthNames } from "@/utils/dateUtils";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { useState } from "react";

export interface DateFilterFieldsProps {
  filterTypeSelector: DateFilterTypeSelector;
  onFilterTypeChange: (value: DateFilterTypeSelector) => void;
  selectedMonth: string;
  selectedYear: string;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  selectedPreset: DateFilterPresetId;
  onPresetChange: (value: DateFilterPresetId) => void;
  dateRange: { from: Date | undefined; to: Date | undefined } | undefined;
  onDateRangeSelect: (
    range: { from?: Date; to?: Date } | undefined,
  ) => void;
  dateRangePickerOpen: boolean;
  onDateRangePickerOpenChange: (open: boolean) => void;
}

export const DateFilterFields = ({
  filterTypeSelector,
  onFilterTypeChange,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  selectedPreset,
  onPresetChange,
  dateRange,
  onDateRangeSelect,
  dateRangePickerOpen,
  onDateRangePickerOpenChange,
}: DateFilterFieldsProps) => {
  const yearOptions = getYearOptions();
  const currentMonthNumber = new Date().getMonth() + 1;
  const [relativePopoverOpen, setRelativePopoverOpen] = useState(false);
  const isRelativePresetSelected = isRelativeDateFilterPreset(selectedPreset);
  const mainPillValue = isRelativePresetSelected ? "" : selectedPreset;

  const handleRelativePresetSelect = (presetId: DateFilterPresetId) => {
    onPresetChange(presetId);
    setRelativePopoverOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Filter Type</Label>
        <FilterOptionPills
          ariaLabel="Filter type"
          value={filterTypeSelector}
          onChange={(value) =>
            onFilterTypeChange(value as DateFilterTypeSelector)
          }
          options={[...DATE_FILTER_TYPE_OPTIONS]}
        />
      </div>

      {filterTypeSelector === "single" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={selectedMonth} onValueChange={onMonthChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthNames
                  .filter(
                    (month, index) =>
                      parseInt(selectedYear) !== new Date().getFullYear() ||
                      index < currentMonthNumber,
                  )
                  .map((month, idx) => (
                    <SelectItem
                      key={`${month.value}-${idx}`}
                      value={month.value}
                    >
                      {month.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={selectedYear} onValueChange={onYearChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year, idx) => (
                  <SelectItem key={`${year}-${idx}`} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {filterTypeSelector === "predefined" ? (
        <div className="space-y-2">
          <Label>Period</Label>
          <div className="flex flex-wrap gap-2">
            <FilterOptionPills
              ariaLabel="Predefined date period"
              value={mainPillValue}
              onChange={(value) => onPresetChange(value as DateFilterPresetId)}
              options={DATE_FILTER_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.label,
              }))}
            />
            <Popover
              open={relativePopoverOpen}
              onOpenChange={setRelativePopoverOpen}
              modal={false}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Relative to today periods"
                  aria-expanded={relativePopoverOpen}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                    isRelativePresetSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10 dark:border-0 dark:bg-input/30 dark:text-muted-foreground dark:hover:bg-input/50",
                  )}
                >
                  {isRelativePresetSelected
                    ? getDateFilterPresetLabel(selectedPreset)
                    : "Relative to today"}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(16rem,calc(100vw-2.5rem))] space-y-2 p-2"
                collisionPadding={16}
              >
                <p className="px-2 pt-1 text-xs text-muted-foreground">
                  Rolling periods ending today
                </p>
                <div className="flex flex-col gap-1">
                  {DATE_FILTER_RELATIVE_PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.id;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleRelativePresetSelect(preset.id)}
                        className={cn(
                          "rounded-md px-3 py-2 text-left text-sm transition-colors",
                          "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          isSelected
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground",
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ) : null}

      {filterTypeSelector === "custom" ? (
        <div className="space-y-2">
          <Label>Date Range</Label>
          <DateRangePicker
            open={dateRangePickerOpen}
            onOpenChange={onDateRangePickerOpenChange}
            selected={dateRange}
            onSelect={onDateRangeSelect}
            trigger={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} –{" "}
                      {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            }
          />
        </div>
      ) : null}
    </>
  );
};

export default DateFilterFields;
