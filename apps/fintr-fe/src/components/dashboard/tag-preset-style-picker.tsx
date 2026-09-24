"use client";

import { cn } from "@/lib/utils";
import { TAG_STYLE_PRESETS } from "@/lib/tags/preset-style-images";

type TagPresetStylePickerProps = {
  selectedKey?: string;
  onSelect: (presetKey: string) => void;
  disabled?: boolean;
};

export function TagPresetStylePicker({
  selectedKey,
  onSelect,
  disabled = false,
}: TagPresetStylePickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Sample styles</p>
      <p className="text-xs text-muted-foreground">
        Assign a bundled illustration without generating a new one.
      </p>
      <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto pr-1">
        {TAG_STYLE_PRESETS.map((preset) => {
          const isSelected = selectedKey === preset.key;

          return (
            <button
              key={preset.key}
              type="button"
              disabled={disabled}
              aria-label={`Use ${preset.label} sample`}
              aria-pressed={isSelected}
              onClick={() => onSelect(preset.key)}
              className={cn(
                "overflow-hidden rounded-md border bg-card text-left",
                "transition-colors",
                isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preset.src}
                alt=""
                className="aspect-video w-full object-cover"
              />
              <span className="block truncate px-1 py-1 text-[10px] font-medium leading-tight text-foreground">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
