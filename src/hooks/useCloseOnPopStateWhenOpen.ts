"use client"

import * as React from "react"

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

  React.useEffect(() => {
    if (!open) {
      return
    }

    window.history.pushState({ [historyKey]: true }, "")
    historyEntryActiveRef.current = true

    const handlePopState = () => {
      historyEntryActiveRef.current = false
      onOpenChange(false)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (historyEntryActiveRef.current) {
        historyEntryActiveRef.current = false
        window.history.back()
      }
    }
  }, [open, onOpenChange, historyKey])
}
