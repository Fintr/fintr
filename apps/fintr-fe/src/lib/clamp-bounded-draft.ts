const decimalPlaces = (raw: string): number => {
  const fraction = raw.split(".")[1];
  return fraction?.length ?? 0;
};

const formatBounded = (value: number): string =>
  String(Math.round(value * 100) / 100);

/**
 * Keeps an in-progress draft such as "0." while blocking values outside min/max.
 * Two decimal places is the smallest step, so "0.001" snaps to the minimum.
 */
export const clampBoundedDraft = (
  raw: string,
  bounds: { min?: number; max?: number },
): string => {
  if (bounds.min == null && bounds.max == null) {
    return raw;
  }

  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "" || trimmed === ".") {
    return trimmed;
  }

  if (trimmed === "-" || trimmed === "-.") {
    return "";
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "";
  }

  const min = bounds.min ?? Number.NEGATIVE_INFINITY;
  const max = bounds.max ?? Number.POSITIVE_INFINITY;

  if (max < min) {
    return parsed === 0 && decimalPlaces(trimmed) < 2 ? trimmed : "";
  }

  if (decimalPlaces(trimmed) > 2) {
    const rounded = Math.round(parsed * 100) / 100;
    if (rounded < min) {
      return formatBounded(min);
    }
    if (rounded > max) {
      return formatBounded(max);
    }
    return formatBounded(rounded);
  }

  if (parsed > max) {
    return formatBounded(max);
  }

  if (parsed < min && decimalPlaces(trimmed) >= 2) {
    return formatBounded(min);
  }

  return trimmed;
};

/** Snaps an unfinished below-minimum draft, such as "0", once editing ends. */
export const finalizeBoundedDraft = (
  raw: string,
  bounds: { min?: number; max?: number },
): string => {
  const clamped = clampBoundedDraft(raw, bounds);
  if (bounds.min == null || clamped === "" || clamped === ".") {
    return clamped;
  }

  const parsed = Number(clamped);
  if (!Number.isFinite(parsed) || parsed < bounds.min) {
    return formatBounded(bounds.min);
  }

  return clamped;
};
