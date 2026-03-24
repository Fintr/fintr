"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMobileModalViewportHeight } from "@/hooks/useMobileModalViewportHeight";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { useKeyboardDetector } from "@/hooks/useKeyboardDetector";

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
  const mobileViewportHeight = useMobileModalViewportHeight(isOpen);
  
  // Use the shared platform detection hook for real-time updates
  const { isAndroidNative, isIOSNative, isMobileBrowser, safeAreaInsetBottom, safeAreaInsetTop } = usePlatformDetection();
  
  // Detect keyboard state based on viewport dimensions
  const { isOpen: isKeyboardOpen, visualViewportHeight } = useKeyboardDetector();

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
  
  // Debug logging when modal opens
  useEffect(() => {
    // Logging removed - was causing performance issues on mobile
  }, [isOpen, isAndroidNative, safeAreaInsetBottom, mobileViewportHeight]);

  useEffect(() => {
    if (!isOpen) {
      historyPushedRef.current = false;
      return;
    }

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
          onClose();
        }
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      const isLightboxOpen = checkLightboxOpen();
      if (isLightboxOpen) {
        const event = new CustomEvent("lightbox-close");
        document.dispatchEvent(event);
      } else if (historyPushedRef.current) {
        onClose();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      const selectContent = target.closest('[data-slot="select-content"]');
      if (selectContent) {
        return;
      }
      
      const modal = document.querySelector('[data-modal-content]');
      if (modal && !modal.contains(target)) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscape);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    setTimeout(() => {
      if (isOpen && !checkLightboxOpen()) {
        window.history.pushState({ modalOpen: true, lightboxOpen: false }, "");
        historyPushedRef.current = true;
      }
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("popstate", handlePopState);
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
      
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen, onClose, isMobile]);

  if (!isOpen || !mounted) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const lightbox = document.querySelector(".lightbox-container");
    
    if (lightbox && (lightbox.contains(target) || target.closest(".lightbox-container"))) {
      return;
    }

    if (target === e.currentTarget) {
      return;
    }
  };

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex",
        isMobile ? "items-start justify-start" : "items-center justify-center",
        isMobile ? "p-0" : "p-4",
        isAndroidNative ? "pt-[20px]" : ""
      )}
      onClick={handleOverlayClick}
      onPointerDown={handleOverlayClick}
    >
      {/* Android native only: Paint the 3-button nav background so the backdrop doesn't make it look white. */}
      {isAndroidNative && (
        <div
          className="fixed left-0 right-0 top-0 z-[100.5] pointer-events-none"
          style={{
            height: "20px",
            backgroundColor: "#FAFAF9",
          }}
        />
      )}
      <div
        className={cn(
          "fixed left-0 right-0 top-0 bg-black/50 z-[100]",
          "transition-opacity duration-200"
        )}
        style={{
          // Only apply safe area adjustment for Android native
          // iOS and mobile browsers handle this natively via env()
          ...(isAndroidNative 
            ? { top: 20, bottom: safeAreaInsetBottom > 0 ? `${safeAreaInsetBottom - 1}px` : "calc(var(--safe-area-inset-bottom, 0px) - 2px)" } 
            : { bottom: 0 }),
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const lightbox = document.querySelector(".lightbox-container");
          
          if (lightbox && (lightbox.contains(target) || target.closest(".lightbox-container"))) {
            return;
          }

          if (e.target === e.currentTarget) {
            return;
          }
        }}
      />
      {/* Android native only: Paint the 3-button nav background so the backdrop doesn't make it look white. */}
      {isAndroidNative && (
        <div
          className="fixed left-0 right-0 bottom-0 z-[100.5] pointer-events-none"
          style={{
            height: safeAreaInsetBottom > 0 ? `${safeAreaInsetBottom - 1}px` : "calc(var(--safe-area-inset-bottom, 0px) - 2px)",
            backgroundColor: "#FAFAF9",
          }}
        />
      )}
      <div
        data-modal-content
        className={cn(
          "relative z-[101] bg-background ",
          "w-full",
          isMobile 
            ? "h-full rounded-none" 
            : cn("rounded-lg", maxWidthClasses[maxWidth], "max-h-[90vh]"),
          "overflow-hidden flex flex-col",
          "transition-opacity duration-200",
          isAndroidNative ? "shadow-none  " : "shadow-lg",
          className
        )}
        style={
          isMobile && mobileViewportHeight != null
            ? isAndroidNative
              ? {
                  // Android native: use full viewport height when keyboard is open
                  // When keyboard is closed: subtract safe area from viewport height
                  ...(isKeyboardOpen 
                    ? { height: "100vh" }
                    : { maxHeight: `calc(${mobileViewportHeight}px - ${safeAreaInsetBottom > 0 ? safeAreaInsetBottom + 'px' : 'var(--safe-area-inset-bottom, 0px)' } - 20px + 2px)` }
                  ),
                }
              : {
                  // iOS and mobile browsers: use full viewport height when keyboard is open
                  ...(isKeyboardOpen 
                    ? { height: "100vh" }
                    : { maxHeight: `${mobileViewportHeight}px` }
                  ),
                }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
              data-tutorial-target={closeButtonDataTarget}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            // Ensure minimum height when keyboard is open to prevent content from being too small
            minHeight: isKeyboardOpen ? `max(200px, calc(100% - ${title ? '80px' : '0px'}))` : undefined,
            // No padding needed here - safe area is handled by:
            // 1. Modal maxHeight using visual viewport (accounts for keyboard)
            // 2. White spacer div at bottom for system nav background
            // 3. Native env() CSS for iOS/mobile browsers
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

