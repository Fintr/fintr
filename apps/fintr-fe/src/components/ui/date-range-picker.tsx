"use client"

import type { DateRange } from "@daypicker/react"

import { Calendar } from "@/components/ui/calendar"
import { CalendarPopover } from "@/components/ui/calendar-popover"
import { DateRangeFullscreenSheet } from "@/components/ui/date-range-fullscreen-sheet"
import { useMediaQuery } from "@/hooks/useMediaQuery"

const BELOW_MD_QUERY = "(max-width: 767px)"

export type DateRangePickerProps = {
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
 * Responsive date-range picker: on small screens (< md / 768px) uses a
 * full-viewport bottom `DateRangeFullscreenSheet`; on md+ uses a compact
 * `CalendarPopover` with a two-month `Calendar` in range mode.
 */
export function DateRangePicker({
  open,
  onOpenChange,
  trigger,
  selected,
  onSelect,
  overlayClassName,
}: DateRangePickerProps) {
  const isMobile = useMediaQuery(BELOW_MD_QUERY)

  if (isMobile) {
    return (
      <DateRangeFullscreenSheet
        open={open}
        onOpenChange={onOpenChange}
        trigger={trigger}
        selected={selected}
        onSelect={onSelect}
        overlayClassName={overlayClassName}
      />
    )
  }

  return (
    <CalendarPopover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      align="start"
      contentClassName="min-w-[600px]"
    >
      <Calendar
        mode="range"
        resetOnSelect
        selected={selected}
        onSelect={onSelect}
        autoFocus
        numberOfMonths={2}
      />
    </CalendarPopover>
  )
}
