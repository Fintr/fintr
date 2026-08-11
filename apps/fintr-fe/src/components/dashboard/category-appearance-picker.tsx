"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLOR_PALETTE,
  CATEGORY_ICON_OPTIONS,
  getCategoryLucideIcon,
} from "@/utils/categoryAppearance";

type CategoryAppearancePickerProps = {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  disabled?: boolean;
};

export const CategoryAppearancePicker: React.FC<CategoryAppearancePickerProps> = ({
  icon,
  color,
  onIconChange,
  onColorChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Color</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLOR_PALETTE.map((paletteColor) => {
            const isSelected = color.toUpperCase() === paletteColor.toUpperCase();

            return (
              <button
                key={paletteColor}
                type="button"
                disabled={disabled}
                aria-label={`Select color ${paletteColor}`}
                aria-pressed={isSelected}
                onClick={() => onColorChange(paletteColor)}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform",
                  isSelected
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: paletteColor }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Icon</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {CATEGORY_ICON_OPTIONS.map((iconName) => {
            const Icon = getCategoryLucideIcon(iconName);
            const isSelected = icon === iconName;

            return (
              <button
                key={iconName}
                type="button"
                disabled={disabled}
                aria-label={`Select icon ${iconName}`}
                aria-pressed={isSelected}
                onClick={() => onIconChange(iconName)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
                style={isSelected ? { color } : undefined}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
