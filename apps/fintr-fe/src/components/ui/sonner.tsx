"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

import { toastSurfaceClassNameImportant } from "@/lib/toast-styles"

const TOAST_DURATION_MS = 3000

const neutralToastClassName = toastSurfaceClassNameImportant

const toasterCssVars = {
  pointerEvents: "none",
  "--normal-bg": "var(--background)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--border)",
  "--success-bg": "var(--background)",
  "--success-text": "var(--foreground)",
  "--success-border": "var(--border)",
  "--error-bg": "var(--background)",
  "--error-text": "var(--foreground)",
  "--error-border": "var(--border)",
  "--warning-bg": "var(--background)",
  "--warning-text": "var(--foreground)",
  "--warning-border": "var(--border)",
  "--info-bg": "var(--background)",
  "--info-text": "var(--foreground)",
  "--info-border": "var(--border)",
} as CSSProperties

const Toaster = ({ style, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={TOAST_DURATION_MS}
      visibleToasts={3}
      style={{
        ...toasterCssVars,
        ...style,
      }}
      toastOptions={{
        duration: TOAST_DURATION_MS,
        classNames: {
          toast: neutralToastClassName,
          title: "!text-foreground",
          description: "!text-muted-foreground",
          success: neutralToastClassName,
          error: neutralToastClassName,
          warning: neutralToastClassName,
          info: neutralToastClassName,
          loading: neutralToastClassName,
        },
        style: { pointerEvents: "auto" },
      }}
      {...props}
    />
  )
}

export { Toaster }
