"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          error: '!bg-red-50 !text-red-600 !border-red-200 dark:!bg-red-950 dark:!text-red-300 dark:!border-red-800',
          success: '!bg-green-50 !text-green-600 !border-green-200 dark:!bg-green-950 dark:!text-green-300 dark:!border-green-800',
          warning: '!bg-yellow-50 !text-yellow-600 !border-yellow-200 dark:!bg-yellow-950 dark:!text-yellow-300 dark:!border-yellow-800',
          info: '!bg-blue-50 !text-blue-600 !border-blue-200 dark:!bg-blue-950 dark:!text-blue-300 dark:!border-blue-800',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
