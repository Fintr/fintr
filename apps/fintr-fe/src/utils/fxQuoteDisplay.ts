export type FxQuoteDisplay = {
  displayValue: number;
  unitCurrency: string;
  baseCurrency: string;
};

/**
 * Human-friendly quote from operative multiplier `m` (to per from: fromAmount * m = toAmount).
 * When m < 1, inverts so the label uses a number >= 1 (e.g. 429 VND per 1 PHP).
 */
export function humanFxQuote(
  multiplier: number,
  fromCurrency: string,
  toCurrency: string,
): FxQuoteDisplay {
  const m = multiplier;

  if (!Number.isFinite(m) || m <= 0) {
    return {
      displayValue: m,
      unitCurrency: toCurrency,
      baseCurrency: fromCurrency,
    };
  }

  if (m >= 1) {
    return {
      displayValue: m,
      unitCurrency: toCurrency,
      baseCurrency: fromCurrency,
    };
  }

  return {
    displayValue: 1 / m,
    unitCurrency: fromCurrency,
    baseCurrency: toCurrency,
  };
}

export function formatFxQuoteLabel(quote: FxQuoteDisplay): string {
  return `${quote.unitCurrency} per 1 ${quote.baseCurrency}`;
}

/**
 * Converts a manual rate typed to match the on-screen quote into the operative multiplier.
 * Uses the current auto/recent rate as a hint when the quote format is ambiguous.
 */
export function operativeMultiplierFromManualQuote(
  enteredQuote: number,
  hintOperativeRate: number | null | undefined,
): number {
  if (!Number.isFinite(enteredQuote) || enteredQuote <= 0) {
    return enteredQuote;
  }

  if (
    hintOperativeRate != null &&
    Number.isFinite(hintOperativeRate) &&
    hintOperativeRate > 0
  ) {
    if (hintOperativeRate < 1) {
      return 1 / enteredQuote;
    }

    return enteredQuote;
  }

  const asDirect = enteredQuote;
  const asInverted = 1 / enteredQuote;

  if (asDirect >= 1 && asInverted < 1) {
    if (asInverted < 0.01) {
      return asInverted;
    }

    return asDirect;
  }

  return asDirect;
}
