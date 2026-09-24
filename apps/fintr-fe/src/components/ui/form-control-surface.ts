import { cn } from "@/lib/utils";

/** Shared height for single-line form fields (inputs, selects, grid picker triggers). */
export const formControlHeightClassName = "h-10 min-h-10";

/** Shared horizontal padding and type size for form fields. */
export const formControlPaddingClassName = "px-3 py-2 text-sm";

/** Borderless muted fill shared by inputs, selects, and date triggers. */
export const formControlFillClassName =
  "border-0 bg-input/50 shadow-none dark:bg-input/30";

/** Hover state for interactive form controls (selects, comboboxes, date pickers). */
export const formControlFillHoverClassName =
  "hover:bg-input/60 dark:hover:bg-input/50";

/** Borderless muted fill for text fields (matches GridPicker trigger). */
export const formControlSurfaceClassName = cn(
  formControlFillClassName,
  formControlHeightClassName,
  formControlPaddingClassName,
  "focus-visible:border-transparent",
);

/** Borderless muted fill for selects, comboboxes, and date triggers. */
export const formControlInteractiveSurfaceClassName = cn(
  formControlSurfaceClassName,
  formControlFillHoverClassName,
);

/** Inline field validation error callout (FormError). */
export const formFieldErrorSurfaceClassName =
  "flex items-center mt-1.5 mb-1 rounded-md border border-red-300 bg-red-100/50 p-2 dark:border-red-800/40 dark:bg-red-950/40";

/** Text and icon color for field validation errors. */
export const formFieldErrorTextClassName =
  "text-xs font-medium text-red-900 dark:text-red-400";

/** Plain field error line (no callout box), e.g. GridPicker. */
export const formFieldErrorInlineTextClassName =
  "text-sm text-red-900 dark:text-red-400";

/** Floating label field fill (onboarding; matches tax calculator gross-income row). */
export const floatingLabelFieldSurfaceClassName =
  "border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/40";

/** Label chip on floating fields — same fill as the control so the notch blends. */
export const floatingLabelChipClassName = "bg-blue-50 dark:bg-blue-950/40";
