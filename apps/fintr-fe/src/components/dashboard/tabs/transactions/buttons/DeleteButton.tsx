import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Trash2 } from "lucide-react";
import { cn, transactionDeleteIconButtonClassName } from "@/lib/utils";

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
      className={cn(transactionDeleteIconButtonClassName, className)}
      {...props}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}; 
