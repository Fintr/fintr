"use client"

import * as React from "react"

import { claimHistoryOverCalculatorKeyboard } from "@/lib/calculator-keyboard-history"

/**
 * When `open` is true, pushes a history entry so browser / Android back runs
 * `onOpenChange(false)` first. When the UI closes any other way, removes the
 * synthetic entry with `history.back()` so the user does not need an extra back
 * to leave the page.
 */
export function useCloseOnPopStateWhenOpen(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  historyKey: string,
) {
  const historyEntryActiveRef = React.useRef(false)
  const onOpenChangeRef = React.useRef(onOpenChange)

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  React.useEffect(() => {
    if (!open) {
      return
    }

    // If the calculator keyboard still owns the top history entry (common when
    // the user taps Rates/Date/Currency while the keypad is open), replace that
    // entry instead of stacking — otherwise calculator's deferred history.back()
    // can pop this overlay and close the parent sheet.
    claimHistoryOverCalculatorKeyboard(historyKey)
    historyEntryActiveRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      // A nested overlay (e.g. date picker inside filter sheet) also pushes
      // history. When it closes it calls history.back(), which lands on this
      // entry — do not treat that as closing this layer.
      if (event.state?.[historyKey]) {
        return
      }

      historyEntryActiveRef.current = false
      onOpenChangeRef.current(false)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (!historyEntryActiveRef.current) {
        return
      }

      historyEntryActiveRef.current = false

      // Drop the synthetic overlay entry without leaving a stale listener cycle.
      if (window.history.state?.[historyKey]) {
        window.history.back()
      }
    }
  }, [open, historyKey])
}
