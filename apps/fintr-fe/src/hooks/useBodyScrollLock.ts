"use client"

import * as React from "react"

let lockCount = 0
let savedScrollY = 0

/**
 * Locks document scrolling while `locked` is true. Supports nested overlays
 * via reference counting so an inner modal closing does not unlock the page
 * while an outer sheet is still open.
 */
export function useBodyScrollLock(locked: boolean) {
  React.useLayoutEffect(() => {
    if (!locked) {
      return
    }

    lockCount += 1

    if (lockCount === 1) {
      savedScrollY = window.scrollY
      const body = document.body
      const html = document.documentElement

      body.style.position = "fixed"
      body.style.top = `-${savedScrollY}px`
      body.style.width = "100%"
      body.style.overflow = "hidden"
      html.style.overflow = "hidden"
    }

    return () => {
      lockCount -= 1

      if (lockCount > 0) {
        return
      }

      const body = document.body
      const html = document.documentElement

      body.style.position = ""
      body.style.top = ""
      body.style.width = ""
      body.style.overflow = ""
      html.style.overflow = ""

      try {
        window.scrollTo(0, savedScrollY)
      } catch {
        // JSDOM does not implement scrollTo; safe to ignore in tests.
      }
    }
  }, [locked])
}
