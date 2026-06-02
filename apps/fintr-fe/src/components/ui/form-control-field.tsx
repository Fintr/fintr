"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { formControlHeightClassName } from "@/components/ui/form-control-surface";
import { cn } from "@/lib/utils";

type FormControlFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  controlClassName?: string;
};

/**
 * Two-row field: fixed label row + h-10 control slot so paired grid columns align.
 */
export function FormControlField({
  label,
  htmlFor,
  children,
  className,
  labelClassName,
  controlClassName,
}: FormControlFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
        <Label
          htmlFor={htmlFor}
          className={cn("self-end text-sm leading-none", labelClassName)}
        >
          {label}
        </Label>
        <div
          className={cn(
            "flex w-full min-w-0 items-center",
            formControlHeightClassName,
            "[&_[data-slot=select-trigger]]:size-full [&_[data-slot=select-trigger]]:w-full",
            "[&>button]:size-full [&>button]:w-full",
            "[&_input]:size-full [&_input]:w-full",
            "[&_textarea]:size-full [&_textarea]:w-full",
            controlClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
