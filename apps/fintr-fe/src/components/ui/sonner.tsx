"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const TOAST_DURATION_MS = 3000

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={TOAST_DURATION_MS}
      visibleToasts={3}
      style={{ pointerEvents: "none" }}
      toastOptions={{
        duration: TOAST_DURATION_MS,
        classNames: {
          error: '!bg-red-50 !text-red-900 !border-red-300 dark:!bg-red-950 dark:!text-red-900/50 dark:!border-red-800',
          success: '!bg-teal-50 !text-teal-600 !border-teal-300 dark:!bg-green-950 dark:!text-teal-500 dark:!border-green-800',
          warning: '!bg-yellow-50 !text-yellow-600 !border-yellow-200 dark:!bg-yellow-950 dark:!text-yellow-300 dark:!border-yellow-800',
          info: '!bg-blue-50 !text-blue-600 !border-blue-200 dark:!bg-blue-950 dark:!text-blue-300 dark:!border-blue-800',
        },
        style: { pointerEvents: "auto" },
      }}
      {...props}
    />
  )
}

export { Toaster }
