import { computeInstallmentPlanRevision, toLedgerCents } from "@fintr/domain";

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const roundInstallmentPerPayment = (
  total: number,
  periodMonths: number,
): number => {
  if (!Number.isFinite(total) || periodMonths <= 0) {
    return 0;
  }

  return roundCurrency(total / periodMonths);
};

export const computeInstallmentTotalFromMonthly = (
  monthly: number,
  periodMonths: number,
): number => {
  if (!Number.isFinite(monthly) || periodMonths <= 0) {
    return 0;
  }

  return roundCurrency(monthly * periodMonths);
};

export type InstallmentAmountAnchor = "total" | "monthly";

export const resolveRemainingInstallmentCount = ({
  periodMonths,
  committedMonthsCount,
}: {
  periodMonths: number;
  committedMonthsCount: number;
}): number => Math.max(periodMonths - committedMonthsCount, 0);

export const syncInstallmentAmounts = ({
  anchor,
  total,
  monthly,
  periodMonths,
  paidSoFar = 0,
  committedMonthsCount = 0,
}: {
  anchor: InstallmentAmountAnchor;
  total: number;
  monthly: number;
  periodMonths: number;
  paidSoFar?: number;
  committedMonthsCount?: number;
}): { total: number; monthly: number } => {
  const remainingCount = resolveRemainingInstallmentCount({
    periodMonths,
    committedMonthsCount,
  });

  if (
    paidSoFar > 0
    && remainingCount > 0
    && committedMonthsCount > 0
  ) {
    if (anchor === "monthly") {
      return {
        total: roundCurrency(paidSoFar + monthly * remainingCount),
        monthly,
      };
    }

    const remainingBalance = Math.max(total - paidSoFar, 0);

    return {
      total,
      monthly: roundInstallmentPerPayment(remainingBalance, remainingCount),
    };
  }

  if (periodMonths <= 0) {
    return { total, monthly };
  }

  if (anchor === "monthly") {
    return {
      total: computeInstallmentTotalFromMonthly(monthly, periodMonths),
      monthly,
    };
  }

  return {
    total,
    monthly: roundInstallmentPerPayment(total, periodMonths),
  };
};

export const syncInstallmentRevisionAmounts = ({
  anchor,
  total,
  monthly,
  parentDate,
  effectiveDate,
  periodMonths,
  paidSoFarCents,
  calculatedDates = [],
  priorPerPaymentCents,
  occurrenceCentsByDate,
  exchangeRate,
  ledgerCurrency,
  displayCurrency,
}: {
  anchor: InstallmentAmountAnchor;
  total: number;
  monthly: number;
  parentDate: string;
  effectiveDate: string;
  periodMonths: number;
  paidSoFarCents: number;
  calculatedDates?: string[];
  priorPerPaymentCents?: number;
  occurrenceCentsByDate?: Record<string, number>;
  exchangeRate?: number;
  ledgerCurrency?: string;
  displayCurrency?: string;
}): { total: number; monthly: number } => {
  const rate = Number(exchangeRate);
  const normalizedLedger = ledgerCurrency?.trim().toUpperCase() ?? "";
  const normalizedDisplay = displayCurrency?.trim().toUpperCase() ?? "";
  const usesLedgerMath =
    normalizedLedger
    && normalizedDisplay
    && normalizedLedger !== normalizedDisplay
    && Number.isFinite(rate)
    && rate > 1.001;
  const toLedgerFromDisplayCents = (cents: number): number =>
    usesLedgerMath ? Math.round(cents * rate) : cents;
  const ledgerOccurrenceCentsByDate = Object.fromEntries(
    Object.entries(occurrenceCentsByDate ?? {}).map(([date, cents]) => [
      date,
      toLedgerFromDisplayCents(cents),
    ]),
  );
  const installmentTotalCents = toLedgerCents({
    amount: total,
    fromCurrency: usesLedgerMath ? normalizedDisplay : normalizedLedger,
    ledgerCurrency: usesLedgerMath ? normalizedLedger : normalizedDisplay || "GBP",
    exchangeRate: usesLedgerMath ? rate : 1,
  });
  const priorCents = toLedgerFromDisplayCents(
    priorPerPaymentCents
    ?? Math.round(monthly * 100),
  );

  const revision = computeInstallmentPlanRevision({
    installmentTotalCents,
    currency: usesLedgerMath ? normalizedLedger : "GBP",
    newPeriod: periodMonths,
    parentDate,
    effectiveDate,
    anchor: anchor === "monthly" ? "monthly" : "total",
    paidSoFarCents,
    newMonthlyCents:
      anchor === "monthly"
        ? toLedgerFromDisplayCents(Math.round(monthly * 100))
        : undefined,
    calculatedDates,
    priorPerPaymentCents: priorCents,
    occurrenceCentsByDate: ledgerOccurrenceCentsByDate,
  });

  if (anchor === "monthly") {
    return {
      total: roundCurrency(revision.installmentTotalCents / 100),
      monthly: revision.perPayment,
    };
  }

  const monthlyInDisplay = usesLedgerMath
    ? roundCurrency(revision.perPayment / rate)
    : revision.perPayment;

  return {
    total,
    monthly: monthlyInDisplay,
  };
};

export const resolveInstallmentFormInitialAmounts = ({
  installmentTotal,
  perPaymentAmount,
  periodMonths,
  useStoredTotal = true,
  paidSoFar = 0,
  committedMonthsCount = 0,
  parentDate,
  effectiveDate,
  calculatedDates = [],
  priorPerPaymentCents,
  occurrenceCentsByDate,
  exchangeRate,
  ledgerCurrency,
  displayCurrency,
}: {
  installmentTotal?: number | null;
  perPaymentAmount: number;
  periodMonths: number;
  useStoredTotal?: boolean;
  paidSoFar?: number;
  committedMonthsCount?: number;
  parentDate?: string;
  effectiveDate?: string;
  calculatedDates?: string[];
  priorPerPaymentCents?: number;
  occurrenceCentsByDate?: Record<string, number>;
  exchangeRate?: number;
  ledgerCurrency?: string;
  displayCurrency?: string;
}): { total: number; monthly: number } => {
  const resolvedMonthly = perPaymentAmount;

  if (
    useStoredTotal &&
    installmentTotal != null &&
    installmentTotal > 0 &&
    periodMonths > 0
  ) {
    const total = installmentTotal;
    const monthly =
      resolvedMonthly > 0
        ? resolvedMonthly
        : roundInstallmentPerPayment(installmentTotal, periodMonths);

    if (parentDate && effectiveDate) {
      return syncInstallmentRevisionAmounts({
        anchor: "total",
        total,
        monthly,
        parentDate,
        effectiveDate,
        periodMonths,
        paidSoFarCents: Math.round(paidSoFar * 100),
        calculatedDates,
        priorPerPaymentCents:
          priorPerPaymentCents
          ?? Math.round(monthly * 100),
        occurrenceCentsByDate,
        exchangeRate,
        ledgerCurrency,
        displayCurrency,
      });
    }

    return { total, monthly };
  }

  if (periodMonths <= 0) {
    return { total: resolvedMonthly, monthly: resolvedMonthly };
  }

  return {
    total: computeInstallmentTotalFromMonthly(resolvedMonthly, periodMonths),
    monthly: resolvedMonthly,
  };
};

export const installmentRemainingPaymentsLabel = (
  remainingCount: number,
): string => {
  if (remainingCount <= 0) {
    return "remaining payments";
  }

  if (remainingCount === 1) {
    return "the last payment";
  }

  return `the last ${remainingCount} payments`;
};

export const resolveInstallmentDisplayedPlanTotal = ({
  enteredAmount,
  planTotal,
  perPaymentAmount,
}: {
  enteredAmount: number;
  planTotal: number;
  perPaymentAmount: number;
}): number => {
  const amountLooksLikePerPayment =
    perPaymentAmount > 0
    && planTotal > 0
    && Math.abs(enteredAmount - perPaymentAmount) < 0.005
    && Math.abs(enteredAmount - planTotal) > 0.005;

  if (amountLooksLikePerPayment) {
    return planTotal;
  }

  if (enteredAmount > 0) {
    return enteredAmount;
  }

  return planTotal;
};

export const resolveInstallmentStoredPlanTotal = ({
  installmentTotal,
  perPaymentAmount,
  periodMonths,
  convertedPerPaymentAmount,
  exchangeRate,
}: {
  installmentTotal?: number | null;
  perPaymentAmount: number;
  periodMonths: number;
  convertedPerPaymentAmount?: number | null;
  exchangeRate?: number | null;
}): number => {
  let planTotalInFormCurrency = installmentTotal;
  const derivedTotal = computeInstallmentTotalFromMonthly(
    perPaymentAmount,
    periodMonths,
  );

  if (
    planTotalInFormCurrency != null
    && planTotalInFormCurrency > 0
    && derivedTotal > 0
    && perPaymentAmount > 0
    && periodMonths > 0
  ) {
    const ratio = planTotalInFormCurrency / derivedTotal;
    const rateFromLegs =
      convertedPerPaymentAmount != null
      && Number.isFinite(convertedPerPaymentAmount)
      && convertedPerPaymentAmount > 0
      && perPaymentAmount > 0
        ? convertedPerPaymentAmount / perPaymentAmount
        : null;
    const rateFromFx =
      exchangeRate != null
      && Number.isFinite(exchangeRate)
      && exchangeRate > 1.001
        ? exchangeRate
        : null;
    const ratioLooksLikeFx =
      ratio > 1.5
      && Math.abs(ratio - Math.round(ratio)) < 0.01;
    const inferredRate =
      rateFromFx
      ?? rateFromLegs
      ?? (ratioLooksLikeFx ? Math.round(ratio) : null);

    if (inferredRate != null && inferredRate > 1.001 && ratio > 1.5) {
      const ledgerDerivedTotal = roundCurrency(derivedTotal * inferredRate);
      const looksLikeLedgerTotal =
        Math.abs(planTotalInFormCurrency - ledgerDerivedTotal)
        <= Math.max(ledgerDerivedTotal * 0.02, 1)
        || (
          rateFromFx != null
          || rateFromLegs != null
          || ratioLooksLikeFx
        );

      if (looksLikeLedgerTotal) {
        planTotalInFormCurrency = roundCurrency(
          planTotalInFormCurrency / inferredRate,
        );
      }
    }
  }

  if (planTotalInFormCurrency == null || planTotalInFormCurrency <= 0) {
    return derivedTotal;
  }

  return resolveInstallmentDisplayedPlanTotal({
    enteredAmount: planTotalInFormCurrency,
    planTotal: derivedTotal > 0 ? derivedTotal : planTotalInFormCurrency,
    perPaymentAmount,
  });
};

export const adjustInstallmentTotalForSinglePaymentChange = ({
  planTotal,
  originalPaymentAmount,
  nextPaymentAmount,
}: {
  planTotal: number;
  originalPaymentAmount: number;
  nextPaymentAmount: number;
}): number => {
  if (!Number.isFinite(planTotal) || !Number.isFinite(originalPaymentAmount)) {
    return planTotal;
  }

  if (!Number.isFinite(nextPaymentAmount)) {
    return planTotal;
  }

  const delta = nextPaymentAmount - originalPaymentAmount;

  return roundCurrency(Math.max(planTotal + delta, 0));
};

export const adjustInstallmentThisPaymentForPlanTotalChange = ({
  originalPlanTotal,
  originalPaymentAmount,
  nextPlanTotal,
}: {
  originalPlanTotal: number;
  originalPaymentAmount: number;
  nextPlanTotal: number;
}): number => {
  if (
    !Number.isFinite(originalPlanTotal)
    || !Number.isFinite(originalPaymentAmount)
    || !Number.isFinite(nextPlanTotal)
  ) {
    return originalPaymentAmount;
  }

  const delta = nextPlanTotal - originalPlanTotal;

  return roundCurrency(Math.max(originalPaymentAmount + delta, 0));
};

export const resolveInstallmentSubmitAmount = ({
  isEditMode,
  totalAmount,
  monthlyAmount,
  periodMonths,
  singlePaymentMode = false,
  thisPaymentAmount,
}: {
  isEditMode: boolean;
  totalAmount: string;
  monthlyAmount: string;
  periodMonths: number;
  singlePaymentMode?: boolean;
  thisPaymentAmount?: string;
}): string => {
  const parsedMonthly = Number.parseFloat(monthlyAmount);
  const parsedTotal = Number.parseFloat(totalAmount);
  const parsedThisPayment = Number.parseFloat(thisPaymentAmount ?? "");

  if (isEditMode && singlePaymentMode) {
    if (Number.isFinite(parsedThisPayment) && parsedThisPayment !== 0) {
      return String(parsedThisPayment);
    }

    if (Number.isFinite(parsedTotal) && parsedTotal !== 0) {
      return String(parsedTotal);
    }

    return thisPaymentAmount || totalAmount;
  }

  if (isEditMode) {
    if (Number.isFinite(parsedMonthly) && parsedMonthly !== 0) {
      return String(parsedMonthly);
    }

    if (Number.isFinite(parsedTotal) && periodMonths > 0) {
      return String(roundInstallmentPerPayment(parsedTotal, periodMonths));
    }

    return totalAmount;
  }

  return totalAmount;
};
