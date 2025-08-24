import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Trash2 } from "lucide-react";

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
      variant="ghost"
      size="icon"
      className={`h-8 w-8 text-delete hover:bg-red-100/50 ${className || ''}`}
      {...props}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}; 
