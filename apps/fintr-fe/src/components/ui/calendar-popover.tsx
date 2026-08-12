"use client"

import * as React from "react"

import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

/** Small screens (< md / 768px): bottom sheet spans the screen like an on-screen keyboard. */
const BELOW_MD_CALENDAR_SHEET_QUERY = "(max-width: 767px)"

const CALENDAR_POPOVER_HISTORY_KEY = "__fintrCalendarPopover"

const bottomSheetCalendarClassName = cn(
  "flex max-h-[min(92dvh,44rem)] flex-col overflow-y-auto rounded-none rounded-t-3xl",
  "border-x-0 border-b-0 border-t bg-popover p-0",
  "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl",
  "w-full min-w-full max-w-none",
  "z-[130]"
)

export type CalendarPopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single element (e.g. Button) — forwarded with `asChild` to the trigger. */
  trigger: React.ReactElement
  children: React.ReactNode
  modal?: boolean
  align?: "start" | "center" | "end"
  contentClassName?: string
}

/**
 * Date picker shell: on small screens (< md / 768px) uses a full-width bottom `Sheet`
 * (keyboard-style); otherwise uses `Popover` + `PopoverContent`.
 */
export function CalendarPopover({
  open,
  onOpenChange,
  trigger,
  children,
  modal = false,
  align = "center",
  contentClassName,
}: CalendarPopoverProps) {
  useCloseOnPopStateWhenOpen(open, onOpenChange, CALENDAR_POPOVER_HISTORY_KEY)

  const useBottomSheet = useMediaQuery(BELOW_MD_CALENDAR_SHEET_QUERY)

  if (useBottomSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          nestedOverlay
          overlayClassName="z-[125]"
          onOverlayClick={() => onOpenChange(false)}
          className={cn(bottomSheetCalendarClassName, contentClassName)}
        >
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover modal={modal} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        nestedOverlay
        align={align}
        className={cn("min-w-80 p-0", contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
