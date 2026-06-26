export type FxRatePair = {
  fromCurrency: string;
  toCurrency: string;
};

export function fxPairChanged(
  previous: FxRatePair | null,
  next: FxRatePair,
): boolean {
  if (previous == null) return true;

  return (
    previous.fromCurrency !== next.fromCurrency ||
    previous.toCurrency !== next.toCurrency
  );
}

/**
 * When the from→to leg changes (e.g. account picked after amount currency), or when a
 * stored "recent" rate is far from the live API quote, prefer today's rate.
 */
export function shouldPreferCurrentRateOverRecent({
  pairChanged,
  recentRate,
  currentRate,
  maxRatioDrift = 2,
}: {
  pairChanged: boolean;
  recentRate: number | null | undefined;
  currentRate: number;
  maxRatioDrift?: number;
}): boolean {
  if (pairChanged) return true;

  if (recentRate == null || !Number.isFinite(recentRate) || recentRate <= 0) {
    return true;
  }

  if (!Number.isFinite(currentRate) || currentRate <= 0) {
    return false;
  }

  const ratio = recentRate / currentRate;

  return ratio > maxRatioDrift || ratio < 1 / maxRatioDrift;
}

export function selectAutoFxRate({
  pairChanged,
  recentRates,
  currentRate,
}: {
  pairChanged: boolean;
  recentRates: number[];
  currentRate: number;
}): { rate: number; source: "auto" | "recent" } {
  const mostRecent = recentRates[0] ?? null;
  const preferCurrent = shouldPreferCurrentRateOverRecent({
    pairChanged,
    recentRate: mostRecent,
    currentRate,
  });

  if (preferCurrent || mostRecent == null) {
    return { rate: currentRate, source: "auto" };
  }

  return { rate: mostRecent, source: "recent" };
}
