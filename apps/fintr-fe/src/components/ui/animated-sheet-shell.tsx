"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock"
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen"

const DEFAULT_HISTORY_KEY = "__fintrAnimatedSheet"

const SHEET_BACKDROP_DURATION = 0.2
const SHEET_PANEL_DURATION = 0.38
const SHEET_PANEL_EASE = [0.32, 0.72, 0, 1] as const

const SWIPE_LOCK_MIN_PX = 28
const SWIPE_HORIZONTAL_RATIO = 1.25
const SWIPE_CLOSE_MIN_PX = 96
const SWIPE_CLOSE_WIDTH_RATIO = 0.22

export type AnimatedSheetShellProps = {
  open: boolean
  onRequestClose: () => void
  children: React.ReactNode
  panelClassName?: string
  overlayClassName?: string
  side?: "left" | "right"
  swipeToClose?: boolean
  historyKey?: string
  /** Used for aria-labelledby on the dialog panel */
  titleId?: string
}

export function AnimatedSheetShell({
  open,
  onRequestClose,
  children,
  panelClassName,
  overlayClassName,
  side = "right",
  swipeToClose = false,
  historyKey = DEFAULT_HISTORY_KEY,
  titleId,
}: AnimatedSheetShellProps) {
  const [mounted, setMounted] = React.useState(false)
  const [hasLightbox, setHasLightbox] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const startXRef = React.useRef(0)
  const startYRef = React.useRef(0)
  const swipeActiveRef = React.useRef(false)
  const dragXRef = React.useRef(0)
  const reduceMotion = useReducedMotion()

  const panelOffScreen =
    side === "right" ? { x: "100%" } : { x: "-100%" }

  const backdropDuration = reduceMotion ? 0 : SHEET_BACKDROP_DURATION
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "tween" as const,
        duration: SHEET_PANEL_DURATION,
        ease: SHEET_PANEL_EASE,
      }

  const handleHistoryOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onRequestClose()
      }
    },
    [onRequestClose],
  )

  useCloseOnPopStateWhenOpen(open, handleHistoryOpenChange, historyKey)
  useBodyScrollLock(open)

  React.useLayoutEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement

      if (panelRef.current?.contains(target)) {
        return
      }

      if (
        target.closest("[data-animated-sheet-panel]") ||
        target.closest("[data-slot='select-content']") ||
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[role='dialog']")
      ) {
        return
      }

      e.preventDefault()
    }

    document.addEventListener("touchmove", handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
    }
  }, [open])

  React.useEffect(() => {
    const checkLightbox = () => {
      const lightbox = document.querySelector(".lightbox-container")
      if (!lightbox) {
        setHasLightbox(false)
        return
      }

      const style = window.getComputedStyle(lightbox)
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        lightbox.getAttribute("aria-hidden") !== "true"
      setHasLightbox(isVisible)
    }

    checkLightbox()

    const observer = new MutationObserver(checkLightbox)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "aria-hidden"],
    })

    const interval = setInterval(checkLightbox, 50)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onRequestClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onRequestClose])

  React.useEffect(() => {
    if (!open) {
      setDragX(0)
      dragXRef.current = 0
      swipeActiveRef.current = false
    }
  }, [open])

  const resetSwipe = React.useCallback(() => {
    swipeActiveRef.current = false
    dragXRef.current = 0
    setDragX(0)
  }, [])

  const handleBackdropPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (hasLightbox) return
      if (e.target === e.currentTarget) {
        onRequestClose()
      }
    },
    [hasLightbox, onRequestClose],
  )

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeToClose || side !== "right") return
      if (e.touches.length !== 1) return
      dragXRef.current = 0
      setDragX(0)
      swipeActiveRef.current = false
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    },
    [side, swipeToClose],
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeToClose || side !== "right") return
      if (e.touches.length !== 1) return
      const x = e.touches[0].clientX
      const y = e.touches[0].clientY
      const dx = x - startXRef.current
      const dy = y - startYRef.current

      if (!swipeActiveRef.current) {
        if (
          dx > SWIPE_LOCK_MIN_PX &&
          dx > Math.abs(dy) * SWIPE_HORIZONTAL_RATIO
        ) {
          swipeActiveRef.current = true
        } else {
          return
        }
      }

      if (swipeActiveRef.current && dx > 0) {
        const w = panelRef.current?.offsetWidth ?? 320
        const next = Math.min(dx, w)
        dragXRef.current = next
        setDragX(next)
      }
    },
    [side, swipeToClose],
  )

  const handleTouchEnd = React.useCallback(() => {
    if (!swipeToClose || side !== "right") return
    if (!swipeActiveRef.current) return
    const w = panelRef.current?.offsetWidth ?? 320
    const threshold = Math.max(
      SWIPE_CLOSE_MIN_PX,
      Math.floor(w * SWIPE_CLOSE_WIDTH_RATIO),
    )
    if (dragXRef.current >= threshold) {
      onRequestClose()
    }
    resetSwipe()
  }, [onRequestClose, resetSwipe, side, swipeToClose])

  React.useLayoutEffect(() => {
    if (!swipeToClose || side !== "right" || !open) return

    let cancelled = false
    let detach: (() => void) | undefined
    let raf = 0

    const tryAttach = () => {
      if (cancelled) return
      const el = panelRef.current
      if (!el) {
        raf = requestAnimationFrame(tryAttach)
        return
      }
      const onMove = (e: TouchEvent) => {
        if (!swipeActiveRef.current) return
        if (e.touches.length !== 1) return
        const dx = e.touches[0].clientX - startXRef.current
        if (dx > 0) {
          e.preventDefault()
        }
      }
      el.addEventListener("touchmove", onMove, { passive: false })
      detach = () => {
        el.removeEventListener("touchmove", onMove)
      }
    }

    tryAttach()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      detach?.()
    }
  }, [open, side, swipeToClose])

  const modalContent = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="animated-sheet-backdrop"
          className={cn(
            "pointer-events-auto fixed inset-0 z-[90] bg-black/40 overscroll-none touch-none",
            hasLightbox && "pointer-events-none",
            overlayClassName,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: backdropDuration, ease: "easeOut" }}
          onPointerDown={handleBackdropPointerDown}
          onWheel={(e) => e.preventDefault()}
          role="presentation"
        />
      ) : null}
      {open ? (
        <motion.div
          key="animated-sheet-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-animated-sheet-panel=""
          className={cn(
            "pointer-events-auto fixed z-[100] flex flex-col bg-background shadow-lg overscroll-contain",
            side === "right" &&
              "inset-y-0 right-0 h-full max-h-[100dvh] border-l",
            side === "left" &&
              "inset-y-0 left-0 h-full max-h-[100dvh] border-r",
            panelClassName,
          )}
          initial={reduceMotion ? { opacity: 0 } : panelOffScreen}
          animate={
            reduceMotion
              ? { opacity: 1, x: 0 }
              : {
                  x: swipeToClose && dragX > 0 ? dragX : 0,
                  y: 0,
                }
          }
          exit={reduceMotion ? { opacity: 0 } : panelOffScreen}
          transition={panelTransition}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={resetSwipe}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (!mounted) {
    return null
  }

  return createPortal(modalContent, document.body)
}

export default AnimatedSheetShell
