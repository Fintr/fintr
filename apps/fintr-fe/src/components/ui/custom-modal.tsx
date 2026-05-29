"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMobileModalViewportHeight } from "@/hooks/useMobileModalViewportHeight";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { useKeyboardDetector } from "@/hooks/useKeyboardDetector";
import { useVisualViewportRect } from "@/hooks/useVisualViewportRect";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  closeButtonDataTarget?: string;
  /**
   * Minimum height for modal content when keyboard is open.
   * Prevents modal from becoming too small when keyboard appears.
   * @default "60vh" - ensures content remains usable
   */
  minContentHeightOnKeyboard?: string;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

// Minimum viewport height to consider content usable (not too squished)
const MIN_USABLE_VIEWPORT_HEIGHT_PX = 300;

// When `getMobileModalViewportHeight()` is this much shorter than `innerHeight`, the visible
// area is already compressed (keyboard, or WebView resize). Size the modal to match even if
// `useKeyboardDetector` has not flipped yet (Capacitor inset lag, simulator quirks).
const MOBILE_MODAL_VIEWPORT_SHRINK_THRESHOLD_PX = 80;

const ANDROID_MODAL_HEADER_TOP_PADDING_PX = 24;

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className,
  maxWidth = "2xl",
  closeButtonDataTarget = "close-modal-button",
  minContentHeightOnKeyboard = "60vh",
}) => {
  const [mounted, setMounted] = React.useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const historyPushedRef = React.useRef(false);
  const modalOpenTimeRef = React.useRef<number>(0);
  // Use a ref for onClose to avoid re-running the history/scroll-lock effect
  // every time the parent re-renders with a new inline function reference.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const mobileViewportHeight = useMobileModalViewportHeight(isOpen);
  
  // Use the shared platform detection hook for real-time updates
  const {
    isAndroidNative,
    isAndroidBrowser,
    isIOSNative,
    isIOSBrowser,
    isMobileBrowser,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();
  
  const { isOpen: isKeyboardOpen } = useKeyboardDetector();

  const isViewportVisiblyReduced =
    mobileViewportHeight != null &&
    typeof window !== "undefined" &&
    mobileViewportHeight < window.innerHeight - MOBILE_MODAL_VIEWPORT_SHRINK_THRESHOLD_PX;

  const useKeyboardSizedMobileFrame = isKeyboardOpen || isViewportVisiblyReduced;

  const anchorOverlayToVisualViewport =
    isOpen &&
    mounted &&
    isMobile &&
    (isIOSNative ||
      isIOSBrowser ||
      isAndroidNative ||
      isAndroidBrowser);

  const visualViewportRect = useVisualViewportRect(anchorOverlayToVisualViewport);

  const extendAndroidShellToLayoutBottom =
    isAndroidNative && !useKeyboardSizedMobileFrame;

  const layoutExtentBelowVisualTop =
    typeof window !== "undefined"
      ? Math.round(window.innerHeight - visualViewportRect.top)
      : visualViewportRect.height;

  const anchoredOverlayHeight = extendAndroidShellToLayoutBottom
    ? Math.max(visualViewportRect.height, layoutExtentBelowVisualTop)
    : visualViewportRect.height;

  const androidModalTopPaddingPx =
    isMobile && isAndroidNative
      ? Math.max(
          0,
          ANDROID_MODAL_HEADER_TOP_PADDING_PX -
            (anchorOverlayToVisualViewport ? visualViewportRect.top : 0)
        )
      : 0;

  const mobileModalPanelBottomPaddingPx =
    isMobile && isAndroidNative
      ? Math.max(safeAreaInsetBottom, hasAndroid3ButtonNav ? 48 : 16)
      : 0;

  const backdropUsesAbsoluteLayout = anchorOverlayToVisualViewport;

  const androidBackdropFillsShell =
    isAndroidNative && extendAndroidShellToLayoutBottom;

  const modalBodyScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }

    const shell = modalBodyScrollRef.current;
    if (shell == null) {
      return;
    }

    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !shell.contains(active)) {
      return;
    }

    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [
    isMobile,
    isOpen,
    mobileViewportHeight,
    useKeyboardSizedMobileFrame,
    visualViewportRect.top,
    visualViewportRect.left,
    visualViewportRect.width,
    visualViewportRect.height,
    anchoredOverlayHeight,
  ]);

  useEffect(() => {
    setMounted(true);
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);
  
  useEffect(() => {
    if (!isOpen) {
      historyPushedRef.current = false;
      return;
    }

    const shouldManageHistory = !isMobileBrowser;

    const checkLightboxOpen = () => {
      const lightbox = document.querySelector(".lightbox-container");
      if (!lightbox) return false;
      const style = window.getComputedStyle(lightbox);
      return style.display !== "none" && 
             style.visibility !== "hidden" &&
             lightbox.getAttribute("aria-hidden") !== "true";
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const isLightboxOpen = checkLightboxOpen();
        if (isLightboxOpen) {
          const event = new CustomEvent("lightbox-close");
          document.dispatchEvent(event);
        } else {
          onCloseRef.current();
        }
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      // Prevent modal from closing within 500ms of opening (race condition protection)
      const timeSinceOpen = Date.now() - modalOpenTimeRef.current;
      if (timeSinceOpen < 500) {
        // Re-push our history state if it was lost
        if (!window.history.state?.modalOpen) {
          window.history.pushState({ modalOpen: true, lightboxOpen: false }, "");
        }
        return;
      }

      const isLightboxOpen = checkLightboxOpen();
      if (isLightboxOpen) {
        const event = new CustomEvent("lightbox-close");
        document.dispatchEvent(event);
      } else if (historyPushedRef.current) {
        const state = e.state as { modalOpen?: boolean; lightboxOpen?: boolean } | null;
        // Only close if this is a genuine back navigation (no modalOpen in state)
        // AND we actually pushed a history entry for this modal
        // Ignore popstate events from Next.js router replaceState operations
        if (state?.modalOpen === true) {
          // State still shows modal open - this is likely a Next.js router update, not a back navigation
          return;
        }
        // Check if this looks like a real back button press vs router state update
        // If state is null or doesn't have our modal marker, it's likely a back navigation
        if (state === null || state.modalOpen === undefined) {
          onCloseRef.current();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      const selectContent = target.closest('[data-slot="select-content"]');
      if (selectContent) {
        return;
      }

      if (
        target.closest("[data-calculator-keyboard]")
        || target.closest("[data-grid-picker-modal]")
      ) {
        return;
      }

      const modal = document.querySelector('[data-modal-content]');
      if (modal && !modal.contains(target)) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscape);
    if (shouldManageHistory) {
      window.addEventListener("popstate", handlePopState);
    }
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    // Record when modal opened for race condition protection
    modalOpenTimeRef.current = Date.now();

    if (shouldManageHistory && !historyPushedRef.current) {
      setTimeout(() => {
        if (isOpen && !historyPushedRef.current && !checkLightboxOpen()) {
          window.history.pushState({ modalOpen: true, lightboxOpen: false }, "");
          historyPushedRef.current = true;
        }
      }, 0);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (shouldManageHistory) {
        window.removeEventListener("popstate", handlePopState);
      }
      document.removeEventListener("touchmove", handleTouchMove);
      
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overflow = "";
      
      try {
        window.scrollTo(0, scrollY);
      } catch {
        // JSDOM does not implement scrollTo; safe to ignore in tests.
      }
      
      if (shouldManageHistory && historyPushedRef.current) {
        historyPushedRef.current = false;
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      }
    };
  // onClose is intentionally excluded from deps — we access it via onCloseRef
  // to prevent the scroll-lock effect from re-running on every parent render.
  }, [isOpen, isMobileBrowser]);

  if (!isOpen || !mounted) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const lightbox = document.querySelector(".lightbox-container");

    if (lightbox && (lightbox.contains(target) || target.closest(".lightbox-container"))) {
      return;
    }

    if (target === e.currentTarget) {
      onCloseRef.current();
    }
  };

  const androidBackdropBottomInset =
    safeAreaInsetBottom > 0
      ? `${safeAreaInsetBottom - 1}px`
      : "calc(var(--safe-area-inset-bottom, 0px) - 2px)";

  const backdropStyle: React.CSSProperties = backdropUsesAbsoluteLayout
      ? isAndroidNative
      ? androidBackdropFillsShell
        ? { top: 0, left: 0, right: 0, bottom: 0 }
        : {
            top: 20,
            left: 0,
            right: 0,
            bottom: androidBackdropBottomInset,
          }
      : { top: 0, left: 0, right: 0, bottom: 0 }
    : isAndroidNative
      ? {
          top: 20,
          left: 0,
          right: 0,
          bottom: androidBackdropBottomInset,
        }
      : { top: 0, left: 0, right: 0, bottom: 0 };

  const modalPanelStyle: React.CSSProperties | undefined = (() => {
    if (!isMobile) {
      return undefined;
    }

    const insetStyle: React.CSSProperties = {};

    if (isAndroidNative && androidModalTopPaddingPx > 0) {
      insetStyle.paddingTop = androidModalTopPaddingPx;
    }

    if (mobileModalPanelBottomPaddingPx > 0) {
      insetStyle.paddingBottom = mobileModalPanelBottomPaddingPx;
    }

    if (mobileViewportHeight == null) {
      return Object.keys(insetStyle).length > 0 ? insetStyle : undefined;
    }

    if (isAndroidNative) {
      return {
        ...insetStyle,
        ...(useKeyboardSizedMobileFrame
          ? {
              height: `${mobileViewportHeight}px`,
              maxHeight: `${mobileViewportHeight}px`,
            }
          : extendAndroidShellToLayoutBottom
            ? {
                height: `${anchoredOverlayHeight}px`,
                maxHeight: `${anchoredOverlayHeight}px`,
              }
            : {
                maxHeight: `calc(${mobileViewportHeight}px - ${safeAreaInsetBottom > 0 ? safeAreaInsetBottom + "px" : "var(--safe-area-inset-bottom, 0px)"} - 20px + 2px)`,
              }
        ),
      };
    }

    return {
      ...insetStyle,
      ...(useKeyboardSizedMobileFrame
        ? {
            height: `${mobileViewportHeight}px`,
            maxHeight: `${mobileViewportHeight}px`,
          }
        : { maxHeight: `${mobileViewportHeight}px` }),
    };
  })();

  const modalContent = (
    <div
      className={cn(
        "fixed z-[100]",
        anchorOverlayToVisualViewport && isMobile
          ? "flex min-h-0 flex-col"
          : "flex",
        anchorOverlayToVisualViewport ? "" : "inset-0",
        anchorOverlayToVisualViewport && isMobile
          ? ""
          : isMobile
            ? "items-start justify-start"
            : "items-center justify-center",
        isMobile ? "p-0" : "p-4",
        isAndroidNative && !anchorOverlayToVisualViewport ? "pt-[20px]" : "",
      )}
      style={
        anchorOverlayToVisualViewport
          ? {
              top: visualViewportRect.top,
              left: visualViewportRect.left,
              width: visualViewportRect.width,
              height: anchoredOverlayHeight,
            }
          : undefined
      }
      onClick={handleOverlayClick}
      onPointerDown={handleOverlayClick}
    >
      {/* Android native only: Paint the 3-button nav background so the backdrop doesn't make it look white. */}
      {isAndroidNative && (
        <div
          className={cn(
            "left-0 right-0 top-0 z-[100.5] pointer-events-none bg-background",
            backdropUsesAbsoluteLayout ? "absolute" : "fixed",
          )}
          style={{
            height: "20px",
          }}
        />
      )}
      <div
        data-testid="custom-modal-backdrop"
        className={cn(
          "z-[100] bg-black/50",
          "transition-opacity duration-200",
          backdropUsesAbsoluteLayout ? "absolute" : "fixed",
        )}
        style={backdropStyle}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const lightbox = document.querySelector(".lightbox-container");

          if (lightbox && (lightbox.contains(target) || target.closest(".lightbox-container"))) {
            return;
          }

          if (e.target === e.currentTarget) {
            onCloseRef.current();
          }
        }}
      />
      {/* Android native only: Paint the 3-button nav background so the backdrop doesn't make it look white. */}
      {isAndroidNative && !androidBackdropFillsShell && (
        <div
          className={cn(
            "left-0 right-0 bottom-0 z-[100.5] pointer-events-none bg-background",
            backdropUsesAbsoluteLayout ? "absolute" : "fixed",
          )}
          style={{
            height: safeAreaInsetBottom > 0 ? `${safeAreaInsetBottom - 1}px` : "calc(var(--safe-area-inset-bottom, 0px) - 2px)",
          }}
        />
      )}
      <div
        data-modal-content
        className={cn(
          "relative z-[101] bg-background ",
          "w-full",
          isMobile 
            ? "min-h-0 flex-1 rounded-none" 
            : cn("rounded-lg", maxWidthClasses[maxWidth], "max-h-[90vh]"),
          isMobile && !isAndroidNative && "pt-safe-top",
          "overflow-hidden flex flex-col",
          "transition-opacity duration-200",
          isAndroidNative ? "shadow-none  " : "shadow-lg",
          className
        )}
        style={modalPanelStyle}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
          </div>
        )}
        <div
          ref={modalBodyScrollRef}
          className="flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            minHeight: useKeyboardSizedMobileFrame
              ? `max(200px, calc(100% - ${title ? '80px' : '0px'}))`
              : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
