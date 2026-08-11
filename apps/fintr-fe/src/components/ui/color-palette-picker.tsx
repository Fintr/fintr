"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR_PALETTE } from "@/utils/categoryAppearance";

type ColorPalettePickerProps = {
  color: string;
  onColorChange: (color: string) => void;
  disabled?: boolean;
};

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  color,
  onColorChange,
  disabled = false,
}) => {
  return (
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
  );
};
