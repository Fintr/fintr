import { describe, it, expect, afterEach } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import { Calendar } from "./calendar"

describe("Calendar", () => {
  afterEach(() => {
    cleanup()
  })

  it("lays out caption navigation as [previous] [month & year] [next] for one month", () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 4, 7)}
        numberOfMonths={1}
      />,
    )

    const captionNav = screen.getByTestId("calendar-caption-nav")
    const columns = captionNav.children
    expect(columns).toHaveLength(3)

    const left = columns[0] as HTMLElement
    const middle = columns[1] as HTMLElement
    const right = columns[2] as HTMLElement

    const prev = within(left).getByRole("button", {
      name: /go to the previous month/i,
    })
    expect(prev).toBeTruthy()

    const monthSelect = within(middle).getByRole("combobox", {
      name: /choose the month/i,
    })
    const yearSelect = within(middle).getByRole("combobox", {
      name: /choose the year/i,
    })
    expect(monthSelect).toBeTruthy()
    expect(yearSelect).toBeTruthy()

    const next = within(right).getByRole("button", {
      name: /go to the next month/i,
    })
    expect(next).toBeTruthy()
  })

  it("places previous on the first month and next on the last when two months are shown", () => {
    render(
      <Calendar
        mode="range"
        defaultMonth={new Date(2026, 4, 1)}
        numberOfMonths={2}
      />,
    )

    const rows = screen.getAllByTestId("calendar-caption-nav")
    expect(rows).toHaveLength(2)

    const first = rows[0]
    const last = rows[1]

    expect(
      within(first.children[0] as HTMLElement).getByRole("button", {
        name: /go to the previous month/i,
      }),
    ).toBeTruthy()

    expect(
      within(first.children[2] as HTMLElement).queryByRole("button"),
    ).toBeNull()

    expect(
      within(last.children[0] as HTMLElement).queryByRole("button"),
    ).toBeNull()

    expect(
      within(last.children[2] as HTMLElement).getByRole("button", {
        name: /go to the next month/i,
      }),
    ).toBeTruthy()
  })
})
