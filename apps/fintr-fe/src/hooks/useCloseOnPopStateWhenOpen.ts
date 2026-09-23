"use client"

import * as React from "react"

import { claimHistoryOverCalculatorKeyboard } from "@/lib/calculator-keyboard-history"

const pendingHistoryBackTimers = new Map<string, ReturnType<typeof setTimeout>>()

function cancelPendingHistoryBack(historyKey: string) {
  const timer = pendingHistoryBackTimers.get(historyKey)
  if (timer == null) {
    return
  }

  clearTimeout(timer)
  pendingHistoryBackTimers.delete(historyKey)
}

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

    // React Strict Mode runs this effect, cleans it up, then runs it again
    // before a deferred history.back() can fire. Cancel that back and reuse
    // the entry still on top — otherwise the late popstate closes the sheet.
    // The timer is module-scoped so a fresh instance can cancel it too.
    cancelPendingHistoryBack(historyKey)

    // If the calculator keyboard still owns the top history entry (common when
    // the user taps Rates/Date/Currency while the keypad is open), replace that
    // entry instead of stacking — otherwise calculator's deferred history.back()
    // can pop this overlay and close the parent sheet.
    if (!window.history.state?.[historyKey]) {
      claimHistoryOverCalculatorKeyboard(historyKey)
    }
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

      // Defer the pop so a remount in the same turn can cancel it. Calling
      // history.back() here lets its popstate land on the new listener and
      // dismiss the overlay the user just opened.
      pendingHistoryBackTimers.set(
        historyKey,
        setTimeout(() => {
          pendingHistoryBackTimers.delete(historyKey)

          if (window.history.state?.[historyKey]) {
            window.history.back()
          }
        }, 0),
      )
    }
  }, [open, historyKey])
}
