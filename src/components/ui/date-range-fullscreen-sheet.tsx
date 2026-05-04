"use client"

import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const DATE_RANGE_HISTORY_KEY = "__fintrDateRangeSheet"

/**
 * When a full range is already selected, react-day-picker's next click often
 * keeps the old start and sets `to` to the clicked day. For filters we want the
 * first tap after a complete range to always be the new **range start**.
 */
function normalizeFirstClickAfterFullRange(
  prior: DateRange | undefined,
  range: DateRange | undefined,
  clickedDay: Date,
): DateRange | undefined {
  const hadFullRange =
    prior?.from != null && prior?.to != null;
  if (!hadFullRange) {
    return range;
  }
  if (range === undefined) {
    return undefined;
  }
  return { from: clickedDay, to: undefined };
}

export type DateRangeFullscreenSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single element (e.g. `Button`) — forwarded with `asChild` to the trigger. */
  trigger: React.ReactElement
  selected: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
  /** Merged into `SheetOverlay` when the sheet must stack above another layer. */
  overlayClassName?: string
}

/**
 * Full-viewport range picker: calendar docked at the bottom; upper area is a
 * frosted strip over the page (via overlay + local blur). Respects safe-area
 * for notches and Android system / gesture nav. Pushes history so back closes first.
 */
export function DateRangeFullscreenSheet({
  open,
  onOpenChange,
  trigger,
  selected,
  onSelect,
  overlayClassName,
}: DateRangeFullscreenSheetProps) {
  useCloseOnPopStateWhenOpen(open, onOpenChange, DATE_RANGE_HISTORY_KEY)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        overlayClassName={cn(
          "bg-background/50 backdrop-blur-md",
          overlayClassName,
        )}
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden",
          "rounded-none border-0 bg-transparent p-0 shadow-none",
        )}
      >
        <SheetTitle className="sr-only">Select date range</SheetTitle>

        <button
          type="button"
          aria-label="Dismiss calendar"
          className={cn(
            "flex min-h-0 flex-1 touch-manipulation appearance-none",
            "w-full cursor-pointer border-0 bg-background/30 p-0 outline-none",
            "backdrop-blur-xl backdrop-saturate-150",
            "pl-[max(0px,env(safe-area-inset-left))]",
            "pr-[max(0px,env(safe-area-inset-right))]",
            "pt-[max(0.5rem,env(safe-area-inset-top))]",
          )}
          onClick={(e) => {
            e.stopPropagation()
            onOpenChange(false)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
        />

        <div
          className={cn(
            "relative shrink-0",
            "rounded-t-3xl border-t border-border/80 bg-background",
            "shadow-[0_-12px_40px_rgba(0,0,0,0.12)]",
            "pl-[max(1rem,env(safe-area-inset-left))]",
            "pr-[max(1rem,env(safe-area-inset-right))]",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "pt-3",
          )}
        >
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(range, clickedDay) => {
              const next = normalizeFirstClickAfterFullRange(
                selected,
                range,
                clickedDay,
              );
              onSelect(next);
            }}
            initialFocus
            numberOfMonths={1}
            className={cn(
              "mx-auto w-full max-w-full",
              "p-2 sm:p-3",
            )}
            classNames={{
              months: "flex w-full flex-col",
              month: "flex w-full flex-col gap-3",
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
