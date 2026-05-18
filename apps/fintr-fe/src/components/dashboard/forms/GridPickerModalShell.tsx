"use client";

import React, { useCallback, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";

const GRID_PICKER_MODAL_HISTORY_KEY = "__fintrGridPickerModal";

export type GridPickerModalShellProps = {
  open: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
};

export const GridPickerModalShell: React.FC<GridPickerModalShellProps> = ({
  open,
  onRequestClose,
  children,
  panelClassName,
}) => {
  const reduceMotion = useReducedMotion();
  const {
    isAndroidNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();

  const androidPanelBottomInsetPx =
    isAndroidNative
      ? Math.max(safeAreaInsetBottom, hasAndroid3ButtonNav ? 48 : 16)
      : 0;

  const handleBackdropPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target === e.currentTarget) {
        onRequestClose();
      }
    },
    [onRequestClose],
  );

  const handleHistoryOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onRequestClose();
      }
    },
    [onRequestClose],
  );

  useCloseOnPopStateWhenOpen(open, handleHistoryOpenChange, GRID_PICKER_MODAL_HISTORY_KEY);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onRequestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onRequestClose]);

  const backdropDuration = reduceMotion ? 0 : 0.18;
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "tween" as const,
        duration: 0.38,
        ease: [0.32, 0.72, 0, 1] as const,
      };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="grid-picker-backdrop"
          className={cn(
            "fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/50",
            !isAndroidNative && "pb-[env(safe-area-inset-bottom,0px)]",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: backdropDuration }}
          onPointerDown={handleBackdropPointerDown}
          role="presentation"
        >
          <motion.div
            className={cn(
              "relative z-[2] mx-auto flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-lg",
              isAndroidNative ? "bg-background" : "bg-white",
              panelClassName,
            )}
            style={
              androidPanelBottomInsetPx > 0
                ? { paddingBottom: androidPanelBottomInsetPx }
                : undefined
            }
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={panelTransition}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
