/** Shared installment split / revision math. Canonical behavior: docs/installment_plans.md */

export const INSTALLMENT_REVISION_ANCHORS = ["total", "monthly", "explicit"] as const;

export type InstallmentRevisionAnchor = (typeof INSTALLMENT_REVISION_ANCHORS)[number];

export type InstallmentPlanRevisionInput = {
  installmentTotalCents: number;
  currency: string;
  newPeriod: number;
  parentDate: string;
  effectiveDate: string;
  anchor: InstallmentRevisionAnchor;
  paidSoFarCents: number;
  newMonthlyCents?: number | null;
  calculatedDates?: string[];
  /** Fallback per frozen month when that date is missing from occurrenceCentsByDate. */
  priorPerPaymentCents?: number | null;
  /**
   * Actual amounts by occurrence date. Frozen months (before effectiveDate) use
   * these so a this-only bump on the revision anchor is released into the
   * remaining pool instead of locking earlier months at the bumped rate.
   */
  occurrenceCentsByDate?: Record<string, number>;
};

export type InstallmentPlanRevisionResult = {
  installmentTotalCents: number;
  perPayment: number;
  remainingCount: number;
  paidSoFarCents: number;
};

const roundHalfUp = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const parseDate = (value: string): Date => {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addMonthsUtc = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

export const installmentOccurrenceDates = ({
  parentDate,
  period,
  fromDate,
}: {
  parentDate: string;
  period: number;
  fromDate?: string;
}): string[] => {
  const parent = parseDate(parentDate);
  const from = fromDate ? parseDate(fromDate) : parent;
  const dates: string[] = [];

  for (let index = 0; index < period; index += 1) {
    const occurrence = addMonthsUtc(parent, index);
    if (occurrence.getTime() >= from.getTime()) {
      dates.push(formatDate(occurrence));
    }
  }

  return dates;
};

export const installmentRemainingOccurrenceDates = ({
  parentDate,
  period,
  effectiveDate,
}: {
  parentDate: string;
  period: number;
  effectiveDate: string;
  calculatedDates?: string[];
}): string[] =>
  installmentOccurrenceDates({
    parentDate,
    period,
    fromDate: effectiveDate,
  });

export const installmentFrozenOccurrenceDates = ({
  parentDate,
  period,
  effectiveDate,
}: {
  parentDate: string;
  period: number;
  effectiveDate: string;
  calculatedDates?: string[];
}): string[] => {
  const effectiveTime = parseDate(effectiveDate).getTime();

  return installmentOccurrenceDates({
    parentDate,
    period,
  }).filter((date) => parseDate(date).getTime() < effectiveTime);
};

export const computeInstallmentPlanRevision = (
  input: InstallmentPlanRevisionInput,
): InstallmentPlanRevisionResult => {
  const remainingDates = installmentRemainingOccurrenceDates({
    parentDate: input.parentDate,
    period: input.newPeriod,
    effectiveDate: input.effectiveDate,
  });
  const remainingCount = remainingDates.length;

  if (remainingCount === 0) {
    throw new Error("Installment term must leave at least one remaining payment");
  }

  const frozenDates = installmentFrozenOccurrenceDates({
    parentDate: input.parentDate,
    period: input.newPeriod,
    effectiveDate: input.effectiveDate,
  });
  const priorPerPaymentCents = input.priorPerPaymentCents ?? 0;
  const occurrenceCentsByDate = input.occurrenceCentsByDate ?? {};
  const lockedCents = frozenDates.reduce(
    (sum, date) =>
      sum + (occurrenceCentsByDate[date] ?? priorPerPaymentCents),
    0,
  );
  const paidSoFar = lockedCents / 100;

  if (input.anchor === "monthly") {
    const monthlyCents = input.newMonthlyCents;
    if (monthlyCents == null) {
      throw new Error("Monthly amount is required for keep monthly revision");
    }

    const perPayment = monthlyCents / 100;
    const installmentTotalCents = lockedCents + monthlyCents * remainingCount;

    return {
      installmentTotalCents,
      perPayment,
      remainingCount,
      paidSoFarCents: input.paidSoFarCents,
    };
  }

  const total = input.installmentTotalCents / 100;
  const remainingTotal = total - paidSoFar;
  const perPayment = roundHalfUp(remainingTotal / remainingCount);

  return {
    installmentTotalCents: input.installmentTotalCents,
    perPayment,
    remainingCount,
    paidSoFarCents: input.paidSoFarCents,
  };
};

export const toLedgerCents = ({
  amount,
  fromCurrency,
  ledgerCurrency,
  exchangeRate,
}: {
  amount: number;
  fromCurrency?: string | null;
  ledgerCurrency?: string | null;
  exchangeRate?: number | null;
}): number => {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  const from = fromCurrency?.trim().toUpperCase() ?? "";
  const ledger = ledgerCurrency?.trim().toUpperCase() ?? "";
  const rate = Number(exchangeRate);

  if (
    from
    && ledger
    && from !== ledger
    && Number.isFinite(rate)
    && rate > 0
  ) {
    return Math.round(amount * rate * 100);
  }

  return Math.round(amount * 100);
};

export const resolveInstallmentTotalCents = ({
  installmentTotalCents,
  perPaymentCents,
  period,
  seriesAmountCents,
}: {
  installmentTotalCents?: number | null;
  perPaymentCents: number;
  period: number;
  seriesAmountCents?: number | null;
}): number => {
  if (installmentTotalCents != null && installmentTotalCents > 0) {
    return installmentTotalCents;
  }

  if (seriesAmountCents != null && seriesAmountCents > 0) {
    return seriesAmountCents;
  }

  return perPaymentCents * period;
};

export const computeInstallmentCommitmentTotalCents = ({
  parentDate,
  period,
  defaultPerPaymentCents,
  occurrenceCentsByDate,
}: {
  parentDate: string;
  period: number;
  defaultPerPaymentCents: number;
  occurrenceCentsByDate: Record<string, number>;
}): number => {
  if (period <= 0) {
    return 0;
  }

  return installmentOccurrenceDates({
    parentDate,
    period,
  }).reduce(
    (sum, date) => sum + (occurrenceCentsByDate[date] ?? defaultPerPaymentCents),
    0,
  );
};

export const applyInstallmentThisOnlyTotalDeltaCents = ({
  storedTotalCents,
  period,
  previousAmountCents,
  nextAmountCents,
}: {
  storedTotalCents?: number | null;
  period: number;
  previousAmountCents: number;
  nextAmountCents: number;
}): number => {
  const delta = nextAmountCents - previousAmountCents;
  const base =
    storedTotalCents != null && storedTotalCents > 0
      ? storedTotalCents
      : previousAmountCents * period;

  return base + delta;
};
