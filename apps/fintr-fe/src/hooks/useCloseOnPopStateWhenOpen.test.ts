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
