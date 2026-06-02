import { cn } from "@/lib/utils";

/** Shared height for single-line form fields (inputs, selects, grid picker triggers). */
export const formControlHeightClassName = "h-10 min-h-10";

/** Shared horizontal padding and type size for form fields. */
export const formControlPaddingClassName = "px-3 py-2 text-sm";

/** Borderless muted fill for text fields (matches GridPicker trigger). */
export const formControlSurfaceClassName = cn(
  "border-0 bg-input/30 shadow-none",
  formControlHeightClassName,
  formControlPaddingClassName,
  "focus-visible:border-transparent",
);

/** Borderless muted fill for selects, comboboxes, and date triggers. */
export const formControlInteractiveSurfaceClassName = cn(
  formControlSurfaceClassName,
  "hover:bg-input/50",
);
