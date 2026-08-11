"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock"
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen"
import { usePlatformDetection } from "@/hooks/usePlatformDetection"

gsap.registerPlugin(useGSAP)

const DEFAULT_HISTORY_KEY = "__fintrAnimatedSheet"

/** Matches {@link MobileStickyHeader} Android status-bar clearance. */
const ANDROID_SHEET_TOP_PADDING_PX = 24

const SHEET_BACKDROP_DURATION = 0.22
const SHEET_PANEL_DURATION = 0.4
const SHEET_PANEL_EASE_IN = "power3.in"
const SHEET_PANEL_EASE_OUT = "power3.out"
const SHEET_SNAP_BACK_DURATION = 0.25

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

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches

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
  const [present, setPresent] = React.useState(open)
  const [hasLightbox, setHasLightbox] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const backdropRef = React.useRef<HTMLDivElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const startXRef = React.useRef(0)
  const startYRef = React.useRef(0)
  const swipeActiveRef = React.useRef(false)
  const dragXRef = React.useRef(0)
  const closingRef = React.useRef(false)
  const openRef = React.useRef(open)
  const sideRef = React.useRef(side)
  const enterTokenRef = React.useRef(0)
  const { isAndroidNative } = usePlatformDetection()

  openRef.current = open
  sideRef.current = side

  const nativeSheetSafeAreaClasses = cn(
    "inset-y-0 h-full max-h-[100dvh]",
    !isAndroidNative && "pt-safe-top",
  )

  const handleHistoryOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onRequestClose()
      }
    },
    [onRequestClose],
  )

  useCloseOnPopStateWhenOpen(open, handleHistoryOpenChange, historyKey)
  // Lock as soon as `open` flips true (before the panel mounts) so body
  // `position: fixed` reflow is not competing with the enter tween.
  useBodyScrollLock(open || present)

  React.useLayoutEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    if (open) {
      closingRef.current = false
      setPresent(true)
    }
  }, [open])

  // Park the panel off-screen synchronously on mount so the first paint never
  // flashes the sheet at rest before GSAP starts the enter tween.
  React.useLayoutEffect(() => {
    if (!present) return

    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (!panel || !backdrop) return

    if (!openRef.current) return
    if (closingRef.current) return

    gsap.set(backdrop, { autoAlpha: 0 })
    gsap.set(panel, {
      xPercent: sideRef.current === "right" ? 100 : -100,
      x: 0,
      force3D: true,
    })
  }, [present])

  useGSAP(
    (_context, contextSafe) => {
      if (!present) return

      const panel = panelRef.current
      const backdrop = backdropRef.current
      if (!panel || !backdrop) return

      const reduceMotion = prefersReducedMotion()
      const panelDuration = reduceMotion ? 0 : SHEET_PANEL_DURATION
      const backdropDuration = reduceMotion ? 0 : SHEET_BACKDROP_DURATION
      const off = sideRef.current === "right" ? 100 : -100

      if (open) {
        closingRef.current = false
        const token = ++enterTokenRef.current

        // Keep the panel off-screen for a frame so scroll-lock + child layout
        // can settle, then tween in. Exit stays on the same frame (smooth).
        gsap.set(backdrop, { autoAlpha: 0 })
        gsap.set(panel, { xPercent: off, x: 0, force3D: true })

        let raf2 = 0
        const raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => {
            if (enterTokenRef.current !== token || !openRef.current) return

            gsap.to(backdrop, {
              autoAlpha: 1,
              duration: backdropDuration,
              ease: "power1.out",
              overwrite: "auto",
            })
            gsap.to(panel, {
              xPercent: 0,
              x: 0,
              duration: panelDuration,
              ease: SHEET_PANEL_EASE_OUT,
              overwrite: "auto",
              force3D: true,
            })
          })
        })

        return () => {
          cancelAnimationFrame(raf1)
          cancelAnimationFrame(raf2)
        }
      }

      if (closingRef.current) return
      closingRef.current = true
      enterTokenRef.current += 1

      const finishClose = contextSafe(() => {
        if (openRef.current) {
          closingRef.current = false
          return
        }
        setPresent(false)
        closingRef.current = false
        dragXRef.current = 0
        swipeActiveRef.current = false
      })

      gsap.killTweensOf([panel, backdrop])
      gsap.to(backdrop, {
        autoAlpha: 0,
        duration: backdropDuration,
        ease: "power1.out",
        overwrite: "auto",
      })

      const currentX = Number(gsap.getProperty(panel, "x")) || 0
      const width = panel.offsetWidth || 320
      const remaining =
        sideRef.current === "right"
          ? Math.max(0, width - currentX)
          : Math.max(0, width + currentX)
      const closeDuration = reduceMotion
        ? 0
        : Math.min(
            SHEET_PANEL_DURATION,
            Math.max(0.16, (remaining / width) * SHEET_PANEL_DURATION),
          )

      gsap.to(panel, {
        x: sideRef.current === "right" ? width : -width,
        xPercent: 0,
        duration: closeDuration,
        ease: SHEET_PANEL_EASE_IN,
        overwrite: "auto",
        force3D: true,
        onComplete: finishClose,
      })
    },
    {
      // Keep deps minimal so parent re-renders / lightbox polls cannot restart
      // the enter tween mid-flight (that restart is a common stutter source).
      dependencies: [open, present],
      scope: rootRef,
    },
  )

  React.useEffect(() => {
    if (!present) {
      return
    }

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement

      if (panelRef.current?.contains(target)) {
        return
      }

      if (
        target.closest("[data-animated-sheet-panel]")
        || target.closest("[data-slot='select-content']")
        || target.closest("[data-radix-popper-content-wrapper]")
        || target.closest("[role='dialog']")
      ) {
        return
      }

      e.preventDefault()
    }

    document.addEventListener("touchmove", handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
    }
  }, [present])

  React.useEffect(() => {
    const checkLightbox = () => {
      const lightbox = document.querySelector(".lightbox-container")
      if (!lightbox) {
        setHasLightbox(false)
        return
      }

      const style = window.getComputedStyle(lightbox)
      const isVisible =
        style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0"
        && lightbox.getAttribute("aria-hidden") !== "true"
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

  const resetSwipe = React.useCallback(() => {
    swipeActiveRef.current = false
    dragXRef.current = 0
  }, [])

  const handleBackdropPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (!open || hasLightbox) return
      if (e.target === e.currentTarget) {
        onRequestClose()
      }
    },
    [hasLightbox, onRequestClose, open],
  )

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeToClose || side !== "right" || !open) return
      if (e.touches.length !== 1) return
      const panel = panelRef.current
      if (!panel) return

      gsap.killTweensOf(panel)
      dragXRef.current = 0
      swipeActiveRef.current = false
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    },
    [open, side, swipeToClose],
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeToClose || side !== "right" || !open) return
      if (e.touches.length !== 1) return
      const panel = panelRef.current
      if (!panel) return

      const x = e.touches[0].clientX
      const y = e.touches[0].clientY
      const dx = x - startXRef.current
      const dy = y - startYRef.current

      if (!swipeActiveRef.current) {
        if (
          dx > SWIPE_LOCK_MIN_PX
          && dx > Math.abs(dy) * SWIPE_HORIZONTAL_RATIO
        ) {
          swipeActiveRef.current = true
        } else {
          return
        }
      }

      if (swipeActiveRef.current && dx > 0) {
        const w = panel.offsetWidth || 320
        const next = Math.min(dx, w)
        dragXRef.current = next
        gsap.set(panel, { x: next, xPercent: 0, force3D: true })
      }
    },
    [open, side, swipeToClose],
  )

  const handleTouchEnd = React.useCallback(() => {
    if (!swipeToClose || side !== "right" || !open) return
    if (!swipeActiveRef.current) return

    const panel = panelRef.current
    if (!panel) {
      resetSwipe()
      return
    }

    const w = panel.offsetWidth || 320
    const threshold = Math.max(
      SWIPE_CLOSE_MIN_PX,
      Math.floor(w * SWIPE_CLOSE_WIDTH_RATIO),
    )

    if (dragXRef.current >= threshold) {
      onRequestClose()
      resetSwipe()
      return
    }

    const reduceMotion = prefersReducedMotion()
    gsap.to(panel, {
      x: 0,
      xPercent: 0,
      duration: reduceMotion ? 0 : SHEET_SNAP_BACK_DURATION,
      ease: SHEET_PANEL_EASE_OUT,
      overwrite: "auto",
      force3D: true,
    })
    resetSwipe()
  }, [onRequestClose, open, resetSwipe, side, swipeToClose])

  React.useLayoutEffect(() => {
    if (!swipeToClose || side !== "right" || !present || !open) return

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
  }, [open, present, side, swipeToClose])

  if (!mounted || !present) {
    return null
  }

  const modalContent = (
    <div ref={rootRef}>
      <div
        ref={backdropRef}
        data-testid="animated-sheet-backdrop"
        className={cn(
          "pointer-events-auto fixed inset-0 z-[90] bg-black/40 overscroll-none touch-none will-change-[opacity]",
          hasLightbox && "pointer-events-none",
          !open && "pointer-events-none",
          overlayClassName,
        )}
        onPointerDown={handleBackdropPointerDown}
        onWheel={(e) => e.preventDefault()}
        role="presentation"
      />
      {/*
        Outer shell is GSAP-only (no React `style`) so re-renders cannot
        clobber the transform mid-tween. Inner shell owns safe-area padding.
      */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-animated-sheet-panel=""
        data-modal-content=""
        className={cn(
          "pointer-events-auto fixed z-[100] flex flex-col overflow-hidden bg-background shadow-lg overscroll-contain will-change-transform",
          side === "right"
          && cn("top-0 right-0 border-l", nativeSheetSafeAreaClasses),
          side === "left"
          && cn("top-0 left-0 border-r", nativeSheetSafeAreaClasses),
          panelClassName,
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetSwipe}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex h-full min-h-0 w-full flex-col"
          style={
            isAndroidNative
              ? { paddingTop: ANDROID_SHEET_TOP_PADDING_PX }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default AnimatedSheetShell
