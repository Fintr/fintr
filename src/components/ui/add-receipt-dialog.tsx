"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { isTutorialActiveAtom } from "@/atoms/tutorialAtoms";
import { isNativeCapacitor } from "@/lib/capacitor";
import { useMobileModalViewportHeight } from "@/hooks/useMobileModalViewportHeight";

interface AddReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const AddReceiptDialog: React.FC<AddReceiptDialogProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className,
}) => {
  const isTutorialActive = useAtomValue(isTutorialActiveAtom);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroidNative, setIsAndroidNative] = useState(false);
  const [isIOSNative, setIsIOSNative] = useState(false);
  const historyPushedRef = React.useRef(false);
  const mobileViewportHeight = useMobileModalViewportHeight(isOpen);

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

  // Apply safe-area padding using inline styles so it doesn't depend on
  // html.class injection timing.
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const uaLower = ua.toLowerCase();
    const isAndroid = /android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isNative = isNativeCapacitor();
    const hasAndroidClass = document.documentElement.classList.contains("fintr-native-android");
    const hasIOSClass = document.documentElement.classList.contains("fintr-native-ios");
    setIsAndroidNative(isAndroid && (isNative || hasAndroidClass));
    setIsIOSNative(isIOS && (isNative || hasIOSClass));
  }, []);

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
        if (isTutorialActive) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
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
      if (isTutorialActive) {
        return;
      }
      
      // On mobile, we don't use history manipulation, so ignore popstate events
      if (isMobile) {
        return;
      }
      
      // CRITICAL: Check if file selection is in progress
      // If so, restore the history state immediately and prevent close
      if (typeof (window as any).__fileSelectionInProgress !== 'undefined' && 
          (window as any).__fileSelectionInProgress === true) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Push state back immediately to prevent navigation
        window.history.pushState({ modalOpen: true, lightboxOpen: false }, "");
        historyPushedRef.current = true;
        return;
      }
      
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
      
      const modal = document.querySelector('[data-add-receipt-dialog-content]');
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
      // Don't push history state on mobile to avoid conflicts with native file pickers
      // Mobile file pickers trigger navigation events that conflict with our history management
      if (isOpen && !checkLightboxOpen() && !isMobile) {
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
      
      // Only manipulate history if we pushed a state (desktop only now)
      if (historyPushedRef.current && !isMobile) {
        historyPushedRef.current = false;
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen, onClose, isMobile, isTutorialActive]);

  if (!isOpen || !mounted) return null;

  const isJoyrideElement = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    
    let element: Element | null = target;
    while (element && element !== document.body) {
      const classList = Array.from(element.classList || []);
      const hasJoyrideClass = classList.some(className => 
        className.includes('react-joyride') || 
        className.includes('__floater') || 
        className.includes('__tooltip')
      );
      
      if (hasJoyrideClass) {
        return true;
      }
      
      const style = window.getComputedStyle(element);
      const zIndex = parseInt(style.zIndex, 10);
      if (!isNaN(zIndex) && zIndex >= 10000) {
        return true;
      }
      
      element = element.parentElement;
    }
    
    return false;
  };

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex",
        isMobile ? "items-start justify-start" : "items-center justify-center",
        isMobile ? "p-0" : "p-4"
      )}
      onPointerDown={(e) => {
        if (isTutorialActive && !isJoyrideElement(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={isTutorialActive ? { pointerEvents: 'none' } : undefined}
    >
      <div
        className={cn(
          "fixed left-0 right-0 top-0 bg-black/50 z-[100]",
          "transition-opacity duration-200",
          isTutorialActive ? "pointer-events-none" : "cursor-pointer"
        )}
        style={{
          // Don't dim the Android 3-button safe-area; keep it visible.
          bottom: "var(--safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => {
          if (isTutorialActive) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          
          const target = e.target as HTMLElement;
          const lightbox = document.querySelector(".lightbox-container");
          
          if (lightbox && (lightbox.contains(target) || target.closest(".lightbox-container"))) {
            return;
          }

          // Close dialog when clicking directly on the overlay
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
      {/* Paint the Android 3-button nav background so the backdrop doesn't make it look white. */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[100.5] pointer-events-none"
        style={{
          height: "var(--safe-area-inset-bottom, 0px)",
          backgroundColor: "#FAFAF9",
        }}
      />
      <div
        data-add-receipt-dialog-content
        className={cn(
          "relative z-[101] bg-background shadow-lg text-primary",
          "w-full max-w-md",
          isMobile ? "rounded-none" : "rounded-lg",
          "overflow-hidden flex flex-col",
          "transition-opacity duration-200",
          className
        )}
        style={{
          ...(isMobile && mobileViewportHeight != null
            ? {
                // Leave the Android 3-button navigation safe-area visible behind the overlay.
                maxHeight: `calc(${mobileViewportHeight}px - var(--safe-area-inset-bottom, 0px))`,
              }
            : {}),
          ...(isTutorialActive ? { pointerEvents: 'auto' } : {})
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isTutorialActive && !isJoyrideElement(e.target)) {
            e.stopPropagation();
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (isTutorialActive && !isJoyrideElement(e.target)) {
            e.stopPropagation();
          }
        }}
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
              data-tutorial-target="close-add-receipt-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div
          className="overflow-y-auto pt-safe-top pb-safe-bottom"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            // Apply safe area padding for all native platforms (Android uses CSS vars, iOS uses env())
            paddingTop:
              isMobile
                ? isAndroidNative
                  ? "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))"
                  : "env(safe-area-inset-top, 0px)"
                : undefined,
            paddingBottom:
              isMobile
                ? isAndroidNative
                  ? "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))"
                  : "env(safe-area-inset-bottom, 0px)"
                : undefined,
          } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

