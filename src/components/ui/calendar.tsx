"use client"

import * as React from "react"
import type { MouseEventHandler } from "react"
import { endOfMonth, isSameMonth } from "date-fns"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Button,
  CaptionDropdowns,
  CaptionLabel,
  CaptionNavigation,
  type CaptionProps,
  DayPicker,
  type DropdownProps,
  IconLeft,
  IconRight,
  useDayPicker,
  useNavigation,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const DEFAULT_FROM_YEAR = 2010

/** Single visible select (no overlay caption) to avoid duplicate month/year display. */
function CalendarDropdown({
  value,
  onChange,
  children,
  options,
  "aria-label": ariaLabel,
  className,
  name,
}: DropdownProps) {
  return (
    <div className={cn("relative", className)}>
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
        )}
      >
        {options
          ? options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-5 -translate-y-1/2 text-muted-foreground sm:size-4" />
    </div>
  )
}

function NavSlotPlaceholder() {
  return (
    <span
      aria-hidden
      className="inline-block size-10 shrink-0 sm:size-8"
    />
  )
}

/** Prev | month/year | next with fixed-width side rails so arrows stay put. */
function CalendarDropdownButtonsCaption(props: CaptionProps) {
  const {
    classNames,
    components,
    dir,
    labels,
    locale,
    numberOfMonths = 1,
    styles,
    fromYear = DEFAULT_FROM_YEAR,
    toYear,
  } = useDayPicker()
  const { displayMonth, displayIndex, id } = props
  const { displayMonths, goToMonth, nextMonth, previousMonth } = useNavigation()
  const resolvedToYear = toYear ?? new Date().getFullYear()

  const displayIdx = displayMonths.findIndex((month) =>
    isSameMonth(displayMonth, month),
  )
  const isFirst = displayIdx === 0
  const isLast = displayIdx === displayMonths.length - 1
  const hideNext = numberOfMonths > 1 && (isFirst || !isLast)
  const hidePrevious = numberOfMonths > 1 && (isLast || !isFirst)

  const IconRightComponent = components?.IconRight ?? IconRight
  const IconLeftComponent = components?.IconLeft ?? IconLeft

  const previousLabel = labels.labelPrevious(previousMonth, { locale })
  const nextLabel = labels.labelNext(nextMonth, { locale })

  const handlePreviousClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!previousMonth) {
      return
    }
    goToMonth(previousMonth)
  }

  const handleNextClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!nextMonth) {
      return
    }
    goToMonth(nextMonth)
  }

  const previousClassName = [classNames.nav_button, classNames.nav_button_previous].join(
    " ",
  )
  const nextClassName = [classNames.nav_button, classNames.nav_button_next].join(" ")

  return (
    <div className={classNames.caption} style={styles?.caption}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-md flex-nowrap items-center gap-2",
          "sm:max-w-lg",
        )}
      >
        <div className="flex w-11 shrink-0 items-center justify-center sm:w-8">
          {!hidePrevious ? (
            <Button
              aria-label={previousLabel}
              className={previousClassName}
              disabled={!previousMonth}
              name="previous-month"
              style={styles?.nav_button_previous}
              type="button"
              onClick={handlePreviousClick}
            >
              {dir === "rtl" ? (
                <IconRightComponent
                  className={classNames.nav_icon}
                  style={styles?.nav_icon}
                />
              ) : (
                <IconLeftComponent
                  className={classNames.nav_icon}
                  style={styles?.nav_icon}
                />
              )}
            </Button>
          ) : (
            <NavSlotPlaceholder />
          )}
        </div>

        <div className="flex min-w-0 flex-1 justify-center gap-2">
          <div className="relative rdp-dropdown_month">
            <select
              aria-label="Month: "
              className={cn(
                "h-11 min-h-11 rounded-md border border-input bg-background px-3 pr-9 text-base",
                "sm:h-8 sm:min-h-0 sm:pr-8 sm:text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "appearance-none cursor-pointer",
              )}
              value={displayMonth.getMonth()}
              onChange={(e) => {
                const newMonth = parseInt(e.target.value, 10)
                const newDate = new Date(displayMonth.getFullYear(), newMonth, 1)
                goToMonth(newDate)
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => {
                const now = new Date()
                const currentYear = now.getFullYear()
                const currentMonth = now.getMonth()
                const displayYear = displayMonth.getFullYear()
                let isDisabled = false
                if (displayYear === currentYear && month > currentMonth) {
                  isDisabled = true
                } else if (displayYear > currentYear) {
                  isDisabled = true
                }
                const monthName = new Date(2000, month, 1).toLocaleDateString(locale, {
                  month: "long",
                })
                return (
                  <option key={month} value={month} disabled={isDisabled}>
                    {monthName}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-5 -translate-y-1/2 text-muted-foreground sm:size-4" />
          </div>
          <div className="relative rdp-dropdown_year">
            <select
              aria-label="Year: "
              className={cn(
                "h-11 min-h-11 rounded-md border border-input bg-background px-3 pr-9 text-base",
                "sm:h-8 sm:min-h-0 sm:pr-8 sm:text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "appearance-none cursor-pointer",
              )}
              value={displayMonth.getFullYear()}
              onChange={(e) => {
                const newYear = parseInt(e.target.value, 10)
                const newDate = new Date(newYear, displayMonth.getMonth(), 1)
                goToMonth(newDate)
              }}
            >
              {Array.from({ length: resolvedToYear - fromYear + 1 }, (_, i) => fromYear + i).map((year) => {
                const now = new Date()
                const currentYear = now.getFullYear()
                const isDisabled = year > currentYear
                return (
                  <option key={year} value={year} disabled={isDisabled}>
                    {year}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-5 -translate-y-1/2 text-muted-foreground sm:size-4" />
          </div>
        </div>

        <div className="flex w-11 shrink-0 items-center justify-center sm:w-8">
          {!hideNext ? (
            <Button
              aria-label={nextLabel}
              className={nextClassName}
              disabled={!nextMonth}
              name="next-month"
              style={styles?.nav_button_next}
              type="button"
              onClick={handleNextClick}
            >
              {dir === "rtl" ? (
                <IconLeftComponent
                  className={classNames.nav_icon}
                  style={styles?.nav_icon}
                />
              ) : (
                <IconRightComponent
                  className={classNames.nav_icon}
                  style={styles?.nav_icon}
                />
              )}
            </Button>
          ) : (
            <NavSlotPlaceholder />
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarCaptionBar(props: CaptionProps) {
  const {
    captionLayout,
    classNames,
    components,
    disableNavigation,
    styles,
  } = useDayPicker()
  const { displayMonth, displayIndex, id } = props

  const CaptionLabelComponent = components?.CaptionLabel ?? CaptionLabel

  if (disableNavigation) {
    return (
      <div className={classNames.caption} style={styles?.caption}>
        <CaptionLabelComponent
          displayIndex={displayIndex}
          displayMonth={displayMonth}
          id={id}
        />
      </div>
    )
  }

  if (captionLayout === "dropdown") {
    return (
      <div className={classNames.caption} style={styles?.caption}>
        <CaptionDropdowns
          displayIndex={displayIndex}
          displayMonth={displayMonth}
          id={id}
        />
      </div>
    )
  }

  if (captionLayout === "dropdown-buttons") {
    return <CalendarDropdownButtonsCaption {...props} />
  }

  return (
    <div className={classNames.caption} style={styles?.caption}>
      <CaptionLabelComponent
        displayIndex={displayIndex}
        displayMonth={displayMonth}
        id={id}
      />
      <CaptionNavigation
        displayIndex={displayIndex}
        displayMonth={displayMonth}
        id={id}
      />
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  fromYear = DEFAULT_FROM_YEAR,
  toYear,
  captionLayout = "dropdown-buttons",
  fromDate: fromDateProp,
  toDate: toDateProp,
  components: componentsProp,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const fromDate = fromDateProp ?? new Date(fromYear, 0, 1)
  const toDate = toDateProp ?? endOfMonth(new Date())
  const resolvedToYear = toYear ?? new Date().getFullYear()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      fromYear={fromYear}
      toYear={resolvedToYear}
      fromDate={fromDate}
      toDate={toDate}
      fromMonth={fromDate}
      toMonth={toDate}
      captionLayout={captionLayout}
      className={cn(
        "touch-manipulation p-4 sm:p-3",
        className,
      )}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-2",
        month: "flex flex-col gap-4",
        caption: cn(
          "flex flex-wrap items-center justify-center gap-2 pb-2 pt-1 w-full",
          "sm:pb-0",
        ),
        caption_label: "sr-only",
        caption_dropdowns: "flex flex-row flex-wrap justify-center gap-2",
        vhidden: "sr-only",
        nav: "flex shrink-0 items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-10 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 active:opacity-100 active:scale-95 transition-all sm:size-7",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        table: "w-full border-collapse",
        head_row: "flex w-full justify-between",
        head_cell:
          "text-muted-foreground flex-1 basis-0 min-w-0 py-1 text-center text-xs font-normal sm:text-[0.8rem]",
        row: "mt-3 flex w-full sm:mt-2",
        cell: cn(
          "relative flex-1 basis-0 p-0 text-center text-sm focus-within:relative focus-within:z-20 min-w-0 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md sm:flex-none sm:basis-auto",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "mx-auto flex h-14 min-h-14 w-14 min-w-14 max-w-full items-center justify-center p-0 text-base font-normal aria-selected:opacity-100 sm:size-8 sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0 sm:text-sm",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        IconLeft: ({ className, ...rest }) => (
          <ChevronLeft className={cn("size-5 sm:size-4", className)} {...rest} />
        ),
        IconRight: ({ className, ...rest }) => (
          <ChevronRight className={cn("size-5 sm:size-4", className)} {...rest} />
        ),
        Caption: CalendarCaptionBar,
        ...componentsProp,
      }}
      {...props}
    />
  )
}

export { Calendar }
