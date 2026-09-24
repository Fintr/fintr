"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ColorPalettePicker } from "@/components/ui/color-palette-picker";
import { cn } from "@/lib/utils";
import {
  filterCategoryIconOptions,
  getCategoryIconLabel,
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIcons = useMemo(
    () => filterCategoryIconOptions(searchQuery, { selectedIcon: icon }),
    [icon, searchQuery],
  );

  return (
    <div className="space-y-4">
      <ColorPalettePicker
        color={color}
        onColorChange={onColorChange}
        disabled={disabled}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Icon</p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search icons…"
            aria-label="Search icons"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        {filteredIcons.length === 0 ? (
          <p className="px-2 text-center text-sm text-muted-foreground">
            No icons match your search.
          </p>
        ) : (
          <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto sm:max-h-56 sm:grid-cols-8">
            {filteredIcons.map((iconName) => {
              const Icon = getCategoryLucideIcon(iconName);
              const isSelected = icon === iconName;
              const label = getCategoryIconLabel(iconName);

              return (
                <button
                  key={iconName}
                  type="button"
                  disabled={disabled}
                  title={label}
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
        )}
      </div>
    </div>
  );
};
