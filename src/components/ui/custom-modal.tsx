"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className,
  maxWidth = "2xl",
}) => {
  const [mounted, setMounted] = React.useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const historyPushedRef = React.useRef(false);
  const viewportHeightRef = React.useRef<number | null>(null);

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
      viewportHeightRef.current = null;
      return;
    }

    // Capture viewport height when modal opens to prevent keyboard resize animations
    if (viewportHeightRef.current === null) {
      viewportHeightRef.current = window.innerHeight;
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
      
      // Check if the touch is inside a select dropdown (portaled outside modal)
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

    if (isMobile) {
      setTimeout(() => {
        if (isOpen && !checkLightboxOpen()) {
          window.history.pushState({ modalOpen: true, lightboxOpen: false }, "");
          historyPushedRef.current = true;
        }
      }, 0);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("touchmove", handleTouchMove);
      
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overflow = "";
      
      window.scrollTo(0, scrollY);
      
      if (isMobile && historyPushedRef.current) {
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
        "fixed inset-0 z-[100] flex items-center justify-center",
        isMobile ? "p-0" : "p-4"
      )}
      onClick={handleOverlayClick}
      onPointerDown={handleOverlayClick}
    >
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-[100]",
          "transition-opacity duration-200"
        )}
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
      <div
        data-modal-content
        className={cn(
          "relative z-[101] bg-background shadow-lg",
          "w-full",
          isMobile 
            ? "h-full rounded-none" 
            : cn("rounded-lg", maxWidthClasses[maxWidth], "max-h-[90vh]"),
          "overflow-hidden flex flex-col",
          "transition-opacity duration-200",
          className
        )}
        style={
          isMobile && viewportHeightRef.current
            ? { maxHeight: `${viewportHeightRef.current}px` }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div 
          className="flex-1 overflow-y-auto min-h-0"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

