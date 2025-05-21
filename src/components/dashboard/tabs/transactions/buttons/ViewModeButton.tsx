import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

interface ViewModeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  label: string;
  isActive: boolean;
  onClick: () => void;
  IconComponent: LucideIcon;
}

export const ViewModeButton = ({
  label,
  isActive,
  onClick,
  IconComponent,
  className,
  variant = "outline", // Default variant
  ...props
}: ViewModeButtonProps) => {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className={`flex items-center gap-1 ${isActive ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"} ${className || ''}`}
      {...props}
    >
      <IconComponent size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}; 