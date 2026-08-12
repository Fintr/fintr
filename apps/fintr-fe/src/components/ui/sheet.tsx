import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { getNestedOverlayPortalRoot } from "@/lib/nested-overlay-portal"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, onClick, ...props }, ref) => {
  const [hasLightbox, setHasLightbox] = React.useState(false)
  const overlayRef = React.useRef<HTMLDivElement>(null)

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

  const handleClick = (e: React.MouseEvent) => {
    if (hasLightbox) return
    onClick?.(e)
  }

  return (
    <SheetPrimitive.Overlay
      ref={(node) => {
        overlayRef.current = node as HTMLDivElement
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }}
      className={cn(
        "fixed inset-0 z-[90] bg-black/40",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
        hasLightbox && "pointer-events-none",
        className,
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  [
    "fixed z-[100] gap-4 bg-background p-6 shadow-lg ease-out",
    "data-[state=closed]:animate-out data-[state=closed]:duration-200",
  ].join(" "),
  {
    variants: {
      side: {
        top:
          "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:animate-in data-[state=open]:slide-in-from-top data-[state=open]:duration-200",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
        left:
          "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-200 sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-200 sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Merged into `SheetOverlay` (e.g. higher z-index when opening a sheet from a dialog). */
  overlayClassName?: string
  /** Called when user clicks the overlay (outside the sheet content). Default: closes the sheet. */
  onOverlayClick?: () => void
  /**
   * When `side` is `right`, allow closing by dragging the panel to the right (touch / pointer).
   * Parent should set `onSwipeToClose` to e.g. `() => setOpen(false)`.
   */
  swipeToClose?: boolean
  /** Invoked after a successful swipe-to-dismiss gesture (typically close the sheet). */
  onSwipeToClose?: () => void
  /**
   * Portal into the shared nested-overlay layer (above modals and tutorial).
   * Use for pickers opened from inside transaction modals/sheets.
   */
  nestedOverlay?: boolean
}

const SWIPE_LOCK_MIN_PX = 28
const SWIPE_HORIZONTAL_RATIO = 1.25
const SWIPE_CLOSE_MIN_PX = 96
const SWIPE_CLOSE_WIDTH_RATIO = 0.22

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "right",
      className,
      overlayClassName,
      onOverlayClick,
      swipeToClose = false,
      onSwipeToClose,
      nestedOverlay = false,
      children,
      style,
      onTouchStart: onTouchStartProp,
      onTouchMove: onTouchMoveProp,
      onTouchEnd: onTouchEndProp,
      onTouchCancel: onTouchCancelProp,
      ...props
    },
    ref,
  ) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const startXRef = React.useRef(0)
    const startYRef = React.useRef(0)
    const swipeActiveRef = React.useRef(false)
    const dragXRef = React.useRef(0)
    const [dragX, setDragX] = React.useState(0)

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref],
    )

    const resetSwipe = React.useCallback(() => {
      swipeActiveRef.current = false
      dragXRef.current = 0
      setDragX(0)
    }, [])

    const handleTouchStart = React.useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchStartProp?.(e)
        if (!swipeToClose || side !== "right" || !onSwipeToClose) return
        if (e.touches.length !== 1) return
        dragXRef.current = 0
        setDragX(0)
        swipeActiveRef.current = false
        startXRef.current = e.touches[0].clientX
        startYRef.current = e.touches[0].clientY
      },
      [onSwipeToClose, onTouchStartProp, side, swipeToClose],
    )

    const handleTouchMove = React.useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchMoveProp?.(e)
        if (!swipeToClose || side !== "right" || !onSwipeToClose) return
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
          const w = contentRef.current?.offsetWidth ?? 320
          const next = Math.min(dx, w)
          dragXRef.current = next
          setDragX(next)
        }
      },
      [onSwipeToClose, onTouchMoveProp, side, swipeToClose],
    )

    const handleTouchEnd = React.useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchEndProp?.(e)
        if (!swipeToClose || side !== "right" || !onSwipeToClose) return
        if (!swipeActiveRef.current) return
        const w = contentRef.current?.offsetWidth ?? 320
        const threshold = Math.max(
          SWIPE_CLOSE_MIN_PX,
          Math.floor(w * SWIPE_CLOSE_WIDTH_RATIO),
        )
        if (dragXRef.current >= threshold) {
          onSwipeToClose()
        }
        resetSwipe()
      },
      [onSwipeToClose, onTouchEndProp, resetSwipe, side, swipeToClose],
    )

    const handleTouchCancel = React.useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchCancelProp?.(e)
        resetSwipe()
      },
      [onTouchCancelProp, resetSwipe],
    )

    const handleOverlayClick = () => {
      if (onOverlayClick) {
        onOverlayClick()
      }
    }

    const swipeEnabled = Boolean(swipeToClose && side === "right" && onSwipeToClose)
    const portalContainer = React.useMemo(
      () => (nestedOverlay ? getNestedOverlayPortalRoot() ?? undefined : undefined),
      [nestedOverlay],
    )

    React.useLayoutEffect(() => {
      if (!swipeEnabled) return

      let cancelled = false
      let detach: (() => void) | undefined
      let raf = 0

      const tryAttach = () => {
        if (cancelled) return
        const el = contentRef.current
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
    }, [swipeEnabled])

    return (
      <SheetPortal container={portalContainer}>
        <SheetOverlay className={overlayClassName} onClick={handleOverlayClick} />
        <SheetPrimitive.Content
          ref={setRefs}
          className={cn(sheetVariants({ side }), className)}
          style={{
            ...style,
            transform:
              swipeEnabled && dragX > 0
                ? `translateX(${dragX}px)`
                : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          {...props}
        >
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    )
  },
)
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
