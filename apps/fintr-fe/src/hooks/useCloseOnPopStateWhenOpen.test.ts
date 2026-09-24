import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen"
import {
  acquireCalculatorHistoryEntry,
  releaseCalculatorHistoryEntry,
  CALCULATOR_KEYBOARD_HISTORY_KEY,
} from "@/lib/calculator-keyboard-history"

describe("useCloseOnPopStateWhenOpen + calculator history", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("replaces an active calculator history entry instead of stacking", () => {
    window.history.pushState({ __fintrAddTransactionSheet: true }, "")
    acquireCalculatorHistoryEntry()
    expect(window.history.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]).toBe(true)

    const onOpenChange = vi.fn()
    const { unmount } = renderHook(() =>
      useCloseOnPopStateWhenOpen(true, onOpenChange, "__fintrExchangeRateSelector"),
    )

    expect(window.history.state?.__fintrExchangeRateSelector).toBe(true)
    expect(window.history.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]).toBeUndefined()

    act(() => {
      vi.runAllTimers()
    })

    expect(window.history.state?.__fintrExchangeRateSelector).toBe(true)
    unmount()
  })

  it("still pushStates when calculator history is not on top", () => {
    window.history.pushState({ __fintrAddTransactionSheet: true }, "")

    const onOpenChange = vi.fn()
    renderHook(() =>
      useCloseOnPopStateWhenOpen(true, onOpenChange, "__fintrExchangeRateSelector"),
    )

    expect(window.history.state?.__fintrExchangeRateSelector).toBe(true)
  })

  it("does not close when cleanup history.back pops after the overlay is open again", () => {
    const onOpenChange = vi.fn()
    let dispatchOpeningPopState: (() => void) | null = null
    vi.spyOn(window.history, "back").mockImplementation(() => {
      dispatchOpeningPopState = () => {
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: { __NA: true } }),
        )
      }
    })

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useCloseOnPopStateWhenOpen(
          open,
          onOpenChange,
          "__fintrAddTransactionSheet",
        ),
      { initialProps: { open: true } },
    )

    rerender({ open: false })
    rerender({ open: true })

    act(() => {
      dispatchOpeningPopState?.()
      vi.runAllTimers()
    })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(window.history.state?.__fintrAddTransactionSheet).toBe(true)
  })

  it("still pops the history entry when the overlay closes", () => {
    const onOpenChange = vi.fn()
    const backSpy = vi.spyOn(window.history, "back")

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useCloseOnPopStateWhenOpen(
          open,
          onOpenChange,
          "__fintrAddTransactionSheet",
        ),
      { initialProps: { open: true } },
    )

    expect(window.history.state?.__fintrAddTransactionSheet).toBe(true)

    rerender({ open: false })

    act(() => {
      vi.runAllTimers()
    })

    expect(backSpy).toHaveBeenCalled()
  })

  it("does not history.back after release when another entry is already on top", () => {
    acquireCalculatorHistoryEntry()
    releaseCalculatorHistoryEntry()

    window.history.pushState({ __fintrExchangeRateSelector: true }, "")
    const backSpy = vi.spyOn(window.history, "back")

    act(() => {
      vi.runAllTimers()
    })

    expect(backSpy).not.toHaveBeenCalled()
    expect(window.history.state?.__fintrExchangeRateSelector).toBe(true)
  })
})
