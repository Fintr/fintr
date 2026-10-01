const parseFiniteAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

/**
 * Magnitude only. Income and expense forms keep the entry sign via
 * signedTransactionAmount so a negative amount can flip the type's effect.
 */
export const positiveTransactionFormAmount = (value: unknown): number =>
  Math.abs(parseFiniteAmount(value));

/**
 * Display magnitude with the sign of the stored entry.
 * A value-flipped list amount stays positive when the booked amount is positive.
 * A stored negative expense or income stays negative so the type can flip it.
 */
export const signedTransactionAmount = (
  amount: unknown,
  storedAmount?: unknown,
): number => {
  const display = parseFiniteAmount(amount);
  const stored =
    storedAmount == null || storedAmount === ""
      ? display
      : parseFiniteAmount(storedAmount);

  if (display === 0 && stored === 0) {
    return 0;
  }

  const sign = stored < 0 ? -1 : 1;
  const magnitude = Math.abs(display !== 0 ? display : stored);
  return sign * magnitude;
};

export const signedTransactionFormAmountString = (
  value: unknown,
  storedAmount?: unknown,
): string => {
  const signed = signedTransactionAmount(value, storedAmount);
  if (signed === 0) {
    return value == null ? "" : String(value).trim();
  }

  return String(signed);
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
