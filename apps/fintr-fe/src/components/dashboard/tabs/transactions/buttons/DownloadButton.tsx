import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface DownloadButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
      onClick: () => void;
    }

export const DownloadButton = ({
  className,
  variant,
  size,
  onClick,
  ...props
}: DownloadButtonProps) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        "flex items-center gap-1 border-0 bg-white shadow-xs hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50",
        className,
      )}
      onClick={onClick}
      tabIndex={0} // Make button focusable
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      aria-label="Download data as CSV"
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download
    </Button>
  );
}; 
