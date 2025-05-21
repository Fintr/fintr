import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface DeleteButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export const DeleteButton = ({
  className,
  variant,
  size,
  ...props
}: DeleteButtonProps) => {
  return (
    <Button
      variant="outline"
      className={`flex items-center gap-1 text-red-500 border-red-200 hover:bg-red-50 ${className || ''}`}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
      Delete
    </Button>
  );
}; 