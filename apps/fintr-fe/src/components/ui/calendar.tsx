"use client"

import * as React from "react"
import { endOfMonth, startOfMonth } from "date-fns"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Chevron,
  DayPicker,
  type DropdownProps,
  type MonthProps,
  useDayPicker,
} from "@daypicker/react"
import type { CalendarDay, Modifiers } from "@daypicker/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const DEFAULT_FROM_YEAR = 2010

const springSnappy = {
  type: "spring" as const,
  stiffness: 440,
  damping: 26,
}

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  fromYear?: number
  toYear?: number
  fromDate?: Date
  toDate?: Date
}

function CalendarNavMotionButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const reduceMotion = useReducedMotion()
  const motionProps = props as Parameters<typeof motion.button>[0]

  return (
    <motion.button
      {...motionProps}
      whileTap={
        reduceMotion
          ? undefined
          : { scale: 0.88 }
      }
      transition={{
        type: "spring",
        stiffness: 520,
        damping: 22,
      }}
    />
  )
}

type CalendarDayButtonProps = {
  day: CalendarDay
  modifiers: Modifiers
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function CalendarDayButton({
  day: _day,
  modifiers,
  ...buttonProps
}: CalendarDayButtonProps) {
  const reduceMotion = useReducedMotion()
  const ref = React.useRef<HTMLButtonElement>(null)
  const isDisabled =
    Boolean(buttonProps.disabled) || Boolean(modifiers.disabled)

  React.useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus()
    }
  }, [modifiers.focused])

  const isSelected = Boolean(modifiers.selected)

  return (
    <motion.button
      {...(buttonProps as Parameters<typeof motion.button>[0])}
      ref={ref}
      whileTap={
        isDisabled || reduceMotion || isSelected
          ? undefined
          : { scale: 0.94 }
      }
      transition={{
        type: "spring",
        stiffness: 520,
        damping: 30,
      }}
    />
  )
}

function CalendarDropdown({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
  name,
}: DropdownProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("relative", className)}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -1 }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={springSnappy}
    >
      <select
        name={name}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        className={cn(
          "h-11 min-h-11 rounded-md border border-input bg-background px-3 pr-9 text-base",
          "sm:h-8 sm:min-h-0 sm:pr-8 sm:text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "appearance-none cursor-pointer",
          "shadow-sm transition-shadow focus-visible:shadow-md",
        )}
      >
        {options?.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-5 -translate-y-1/2 text-muted-foreground sm:size-4" />
    </motion.div>
  )
}

function CaptionNavPlaceholder() {
  return (
    <span
      aria-hidden
      className="inline-block size-10 shrink-0 sm:size-8"
    />
  )
}

/**
 * DayPicker v10 renders prev / caption / next as consecutive flex children of
 * `Month`, which stacks vertically under `flex flex-col`. Lay out one row:
 * [previous] [month caption] [next], then the grid below.
 */
function CalendarMonth({
  calendarMonth,
  displayIndex,
  className,
  style,
  children,
  ...rest
}: MonthProps) {
  const { dayPickerProps } = useDayPicker()
  const numberOfMonths = dayPickerProps.numberOfMonths ?? 1

  const childList = React.Children.toArray(children)
  const monthGrid = childList.find(
    (node) =>
      React.isValidElement(node) &&
      typeof node.props === "object" &&
      node.props !== null &&
      "role" in node.props &&
      (node.props as { role?: string }).role === "grid",
  )

  const captionRow = childList.filter((node) => node !== monthGrid)
  let prev: React.ReactNode = null
  let caption: React.ReactNode = null
  let next: React.ReactNode = null

  if (captionRow.length === 1) {
    caption = captionRow[0]
  } else if (captionRow.length === 2) {
    if (displayIndex === 0) {
      prev = captionRow[0]
      caption = captionRow[1]
    } else if (displayIndex === numberOfMonths - 1) {
      caption = captionRow[0]
      next = captionRow[1]
    } else {
      caption = (
        <>
          {captionRow[0]}
          {captionRow[1]}
        </>
      )
    }
  } else if (captionRow.length >= 3) {
    prev = captionRow[0]
    caption = captionRow[1]
    next = captionRow[2]
  }

  return (
    <div
      className={cn(className, "flex flex-col gap-4")}
      style={style}
      {...rest}
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "mx-auto grid w-full max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2",
            "sm:max-w-lg",
          )}
          data-testid="calendar-caption-nav"
        >
          <div className="flex shrink-0 justify-center">
            {prev ?? <CaptionNavPlaceholder />}
          </div>
          <div className="flex min-w-0 justify-center">{caption}</div>
          <div className="flex shrink-0 justify-center">
            {next ?? <CaptionNavPlaceholder />}
          </div>
        </div>
        {monthGrid}
      </div>
    </div>
  )
}

function FintrChevron({
  className,
  orientation,
}: React.ComponentProps<typeof Chevron>) {
  const reduceMotion = useReducedMotion()
  const icon = (() => {
    if (orientation === "down") {
      return (
        <ChevronDown
          className={cn("size-5 sm:size-4", className)}
        />
      )
    }
    if (orientation === "left") {
      return (
        <ChevronLeft
          className={cn("size-5 sm:size-4", className)}
        />
      )
    }
    if (orientation === "right") {
      return (
        <ChevronRight
          className={cn("size-5 sm:size-4", className)}
        />
      )
    }
    return (
      <ChevronDown
        className={cn("size-5 sm:size-4", className)}
      />
    )
  })()

  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileHover={
        reduceMotion
          ? undefined
          : { scale: 1.12 }
      }
      transition={springSnappy}
    >
      {icon}
    </motion.span>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  fromYear = DEFAULT_FROM_YEAR,
  toYear: _toYear,
  captionLayout = "dropdown",
  navLayout = "around",
  fromDate: fromDateProp,
  toDate: toDateProp,
  components: componentsProp,
  ...props
}: CalendarProps) {
  const fromDate = fromDateProp ?? new Date(fromYear, 0, 1)
  const toDate = toDateProp ?? endOfMonth(new Date())
  const startMonthNav = startOfMonth(fromDate)
  const endMonthNav = startOfMonth(toDate)

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      captionLayout={captionLayout}
      navLayout={navLayout}
      startMonth={startMonthNav}
      endMonth={endMonthNav}
      hidden={{
        before: fromDate,
        after: toDate,
      }}
      className={cn(
        "touch-manipulation p-4 sm:p-3",
        className,
      )}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-2",
        month: "flex flex-col gap-4",
        month_caption: cn(
          "flex flex-wrap items-center justify-center gap-2 pb-2 pt-1 w-full",
          "sm:pb-0",
        ),
        caption_label: "sr-only",
        dropdowns: "flex flex-row flex-wrap justify-center gap-2",
        dropdown_root: "relative flex items-center gap-2",
        nav: "flex shrink-0 items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-10 shrink-0 border-border/80 bg-background/80 p-0 opacity-70 shadow-sm",
          "hover:border-primary/40 hover:bg-muted/60 hover:opacity-100",
          "active:bg-muted/80",
          "sm:size-7",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-10 shrink-0 border-border/80 bg-background/80 p-0 opacity-70 shadow-sm",
          "hover:border-primary/40 hover:bg-muted/60 hover:opacity-100",
          "active:bg-muted/80",
          "sm:size-7",
        ),
        month_grid: "w-full border-collapse table-fixed",
        weekdays: "",
        weekday:
          "text-muted-foreground w-[14.285%] py-1 text-center text-xs font-normal sm:text-[0.8rem]",
        week: "mt-3 sm:mt-2",
        day: cn(
          "group/cal-day relative w-[14.285%] p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "rounded-md",
          "ease-out [transition-property:background-color,color,opacity,box-shadow] [transition-duration:150ms]",
          "[&:not([data-selected]):not([data-disabled]):hover]:bg-accent",
          "[&:not([data-selected]):not([data-disabled]):hover]:text-accent-foreground",
          "[&:not([data-selected]):not([data-disabled]):active]:bg-accent/90",
          "[&:not([data-selected]):not([data-disabled]):active]:text-accent-foreground",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-14 w-full max-w-full items-center justify-center p-0 text-base font-normal aria-selected:opacity-100 sm:size-8 sm:h-8 sm:min-h-0 sm:w-8 sm:text-sm",
          "!bg-transparent hover:!bg-transparent active:!bg-transparent focus-visible:!bg-transparent",
          "dark:hover:!bg-transparent dark:active:!bg-transparent",
          "text-inherit",
          "ease-out [transition-property:color,opacity,transform] [transition-duration:150ms]",
        ),
        range_start: cn(
          "day-range-start rounded-md bg-accent",
          "aria-selected:bg-primary aria-selected:text-primary-foreground",
        ),
        range_end: cn(
          "day-range-end rounded-md bg-accent",
          "aria-selected:bg-primary aria-selected:text-primary-foreground",
        ),
        selected: cn(
          "rounded-md bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary hover:text-primary-foreground",
          "active:bg-primary active:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
        ),
        today: cn(
          "bg-accent/90 font-semibold text-accent-foreground",
          "ring-1 ring-primary/25 ring-offset-1 ring-offset-background",
          "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:ring-0 data-[selected]:shadow-none",
        ),
        outside:
          "text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle: cn(
          "rounded-md bg-accent aria-selected:bg-accent aria-selected:text-accent-foreground",
          "hover:bg-accent/90 hover:text-accent-foreground",
          "active:bg-accent/80 active:text-accent-foreground",
        ),
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        Chevron: FintrChevron,
        Month: CalendarMonth,
        PreviousMonthButton: CalendarNavMotionButton,
        NextMonthButton: CalendarNavMotionButton,
        DayButton: CalendarDayButton,
        ...componentsProp,
      }}
      {...props}
      animate={false}
    />
  )
}

export { Calendar }
