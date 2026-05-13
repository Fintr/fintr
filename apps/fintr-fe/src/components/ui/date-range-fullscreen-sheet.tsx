"use client"

import type { DateRange } from "@daypicker/react"

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

const rangeSheetCalendarClassName = cn(
  "flex max-h-[min(92dvh,44rem)] flex-col overflow-y-auto rounded-none rounded-t-3xl",
  "border-x-0 border-b-0 border-t bg-popover p-0",
  "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl",
  "w-full min-w-full max-w-none",
  "z-[130]",
)

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
 * Mobile range picker shell. Mirrors the single-date picker sheet backdrop and
 * bottom-sheet treatment, while rendering a range-mode calendar inside.
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
        overlayClassName={cn("z-[125]", overlayClassName)}
        onOverlayClick={() => onOpenChange(false)}
        className={rangeSheetCalendarClassName}
      >
        <SheetTitle className="sr-only">Select date range</SheetTitle>

        <div
          className={cn(
            "relative shrink-0 bg-popover",
            "pl-[max(1rem,env(safe-area-inset-left))]",
            "pr-[max(1rem,env(safe-area-inset-right))]",
          )}
        >
          <Calendar
            mode="range"
            resetOnSelect
            selected={selected}
            onSelect={onSelect}
            autoFocus
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
