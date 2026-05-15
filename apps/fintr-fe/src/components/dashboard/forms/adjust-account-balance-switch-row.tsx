"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type AdjustAccountBalanceSwitchRowProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  infoAriaLabel: string;
  switchAriaLabel: string;
  popoverTitle: string;
  children: React.ReactNode;
};

export function AdjustAccountBalanceSwitchRow({
  id,
  checked,
  onCheckedChange,
  label,
  infoAriaLabel,
  switchAriaLabel,
  popoverTitle,
  children,
}: AdjustAccountBalanceSwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium text-primary">
          {label}
        </Label>
        <Popover modal={false}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={infoAriaLabel}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(20rem,calc(100vw-2.5rem))] space-y-2 border-gray-200 text-left text-xs text-gray-700"
            side="top"
            align="start"
            collisionPadding={16}
          >
            <p className="font-medium text-primary">{popoverTitle}</p>
            {children}
          </PopoverContent>
        </Popover>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={switchAriaLabel}
      />
    </div>
  );
}
