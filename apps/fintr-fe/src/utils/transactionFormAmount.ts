/**
 * Form inputs always show positive magnitudes; expense vs income sign comes from type.
 */
export const positiveTransactionFormAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.abs(value) : 0;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
  }

  return 0;
};

export const positiveTransactionFormAmountString = (
  value: unknown,
): string => {
  const magnitude = positiveTransactionFormAmount(value);
  if (magnitude === 0) {
    return value == null ? "" : String(value).trim();
  }

  return String(magnitude);
};
