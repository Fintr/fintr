import { UpdateScopeEnum, ScheduleTypeEnum } from "@/constants/transactionConstants";
import type { IndexTransaction } from "@/types/transactionTypes";
import type { UpdateTransactionType } from "@/types/transactionTypes";
import type { UpdateScope } from "@/components/dashboard/forms/ScopeModal";
import { computeInstallmentCommitmentTotalCents } from "@fintr/domain";
import { sameSeriesFingerprint } from "@/services/transactions/resolve-delete-scope";
import { getLocalIsoDateKey } from "@/utils/dateUtils";
import { positiveTransactionFormAmount } from "@/utils/transactionFormAmount";

export type InstallmentRevisionSeriesContext = {
  paidSoFarCents: number;
  committedMonthsCount: number;
  calculatedDates: string[];
  /** Actual series amounts by ISO date — used to lock earlier months correctly. */
  occurrenceCentsByDate: Record<string, number>;
  /** Plan default per payment (not a this-only bump on the edited row). */
  defaultPerPaymentCents: number;
};

export type InstallmentRevisionSeriesContextOptions = {
  displayCurrency?: string;
  fallbackPerPayment?: number;
};

const normalizeCurrency = (value?: string | null): string =>
  value?.trim().toUpperCase() ?? "";

export const resolveInstallmentRevisionDisplayCurrency = (
  transaction: Pick<IndexTransaction, "amountCurrency" | "currencyConversion"> & {
    originalDisplayCurrency?: string | null;
    original_display_currency?: string | null;
  },
  spaceCurrency = "PHP",
): string => {
  const fromOriginal =
    transaction.originalDisplayCurrency
    ?? transaction.original_display_currency;

  if (fromOriginal?.trim()) {
    return fromOriginal.trim();
  }

  const conversionCurrency = transaction.currencyConversion?.originalCurrency;
  if (conversionCurrency?.trim()) {
    return conversionCurrency.trim();
  }

  if (transaction.amountCurrency?.trim()) {
    return transaction.amountCurrency.trim();
  }

  return spaceCurrency;
};

export const resolveInstallmentCommittedRowAmount = (
  row: IndexTransaction,
  displayCurrency?: string,
  fallbackPerPayment?: number,
): number => {
  const targetCurrency = normalizeCurrency(displayCurrency);

  const bookedAmount =
    row.bookedAmount != null
      ? positiveTransactionFormAmount(row.bookedAmount)
      : null;
  const bookedCurrency = normalizeCurrency(row.bookedAmountCurrency);

  if (
    bookedAmount != null
    && bookedCurrency
    && (!targetCurrency || bookedCurrency === targetCurrency)
  ) {
    return bookedAmount;
  }

  const conversion = row.currencyConversion;
  if (conversion) {
    const originalAmount = positiveTransactionFormAmount(conversion.originalAmount);
    const originalCurrency = normalizeCurrency(conversion.originalCurrency);
    const convertedAmount = positiveTransactionFormAmount(conversion.convertedAmount);
    const convertedCurrency = normalizeCurrency(conversion.convertedCurrency);

    if (targetCurrency && originalCurrency === targetCurrency && originalAmount > 0) {
      return originalAmount;
    }

    if (targetCurrency && convertedCurrency === targetCurrency && convertedAmount > 0) {
      return convertedAmount;
    }
  }

  const rowAmount = positiveTransactionFormAmount(row.amount);
  const rowCurrency = normalizeCurrency(row.amountCurrency);

  if (!targetCurrency || !rowCurrency || rowCurrency === targetCurrency) {
    return rowAmount;
  }

  if (fallbackPerPayment != null && fallbackPerPayment > 0) {
    return fallbackPerPayment;
  }

  return rowAmount;
};

export const resolveInstallmentSeriesRows = (
  target: IndexTransaction,
  contextRows: IndexTransaction[],
): IndexTransaction[] => {
  const rootId =
    target.rootParentId?.trim()
    || target.parentId?.trim()
    || target.id;

  // Prefer root linkage. Amount fingerprints break after this-only bumps
  // (one payment differs) and would drop the rest of the series.
  const byRoot = contextRows.filter((row) => {
    const rowRoot =
      row.rootParentId?.trim()
      || row.parentId?.trim()
      || row.id;

    return rowRoot === rootId
      || row.parentId === rootId
      || row.id === rootId;
  });

  if (byRoot.length > 0) {
    return byRoot;
  }

  return contextRows.filter((row) => sameSeriesFingerprint(row, target));
};

export const computeInstallmentRevisionSeriesContext = (
  target: IndexTransaction,
  contextRows: IndexTransaction[],
  options: InstallmentRevisionSeriesContextOptions = {},
): InstallmentRevisionSeriesContext => {
  const seriesRows = resolveInstallmentSeriesRows(target, contextRows);
  const calculatedRows = seriesRows.filter((row) => row.calculated === true);
  const displayCurrency = resolveInstallmentRevisionDisplayCurrency(target);
  const amountCurrency =
    options.displayCurrency ?? displayCurrency;
  const fallbackPerPayment = resolveInstallmentCommittedRowAmount(
    target,
    amountCurrency,
  );
  const paidSoFarCents = calculatedRows.reduce(
    (sum, row) =>
      sum
      + Math.round(
        resolveInstallmentCommittedRowAmount(
          row,
          amountCurrency,
          options.fallbackPerPayment ?? fallbackPerPayment,
        ) * 100,
      ),
    0,
  );

  const rootId =
    target.rootParentId?.trim()
    || target.parentId?.trim()
    || target.id;
  const rootRow =
    seriesRows.find((row) => row.id === rootId)
    ?? seriesRows[0]
    ?? target;

  const occurrenceCentsByDate = seriesRows.reduce<Record<string, number>>(
    (amounts, row) => {
      const dateKey = getLocalIsoDateKey(row.date);
      amounts[dateKey] = Math.round(
        resolveInstallmentCommittedRowAmount(
          row,
          amountCurrency,
          options.fallbackPerPayment ?? fallbackPerPayment,
        ) * 100,
      );
      return amounts;
    },
    {},
  );

  const frozenDefaults = seriesRows
    .filter((row) => {
      const dateKey = getLocalIsoDateKey(row.date);
      return (
        dateKey < getLocalIsoDateKey(target.date)
        && row.calculated !== true
      );
    })
    .map((row) =>
      Math.round(
        resolveInstallmentCommittedRowAmount(
          row,
          amountCurrency,
          options.fallbackPerPayment,
        ) * 100,
      ),
    )
    .filter((cents) => cents > 0);

  const defaultPerPaymentCents =
    (
      frozenDefaults.length > 0
        ? Math.min(...frozenDefaults)
        : Math.round(
            resolveInstallmentCommittedRowAmount(
              rootRow,
              amountCurrency,
              options.fallbackPerPayment,
            ) * 100,
          )
    )
    || Math.round(fallbackPerPayment * 100);

  return {
    paidSoFarCents,
    committedMonthsCount: calculatedRows.length,
    calculatedDates: calculatedRows.map((row) => getLocalIsoDateKey(row.date)),
    occurrenceCentsByDate,
    defaultPerPaymentCents,
  };
};

export const resolveInstallmentRevisionPeriod = (
  nextData: { installmentPeriod?: number | null },
  original: { installmentPeriod?: number | null },
): number => {
  const nextPeriod = Number(nextData.installmentPeriod ?? 0);
  if (nextPeriod > 0) {
    return nextPeriod;
  }

  return Number(original.installmentPeriod ?? 0);
};

export const needsInstallmentPlanRevision = (
  original: UpdateTransactionType,
  newData: UpdateTransactionType,
  scope: UpdateScope,
): boolean => {
  if (original.scheduleType !== ScheduleTypeEnum.INSTALLMENT) {
    return false;
  }

  if (scope === UpdateScopeEnum.THIS_ONLY) {
    return false;
  }

  const periodChanged = original.installmentPeriod !== newData.installmentPeriod;
  const amountChanged = original.amount !== newData.amount;

  return periodChanged || amountChanged;
};

export const resolveInstallmentThisOnlyPlanTotal = ({
  target,
  context,
  parentDate,
  periodMonths,
}: {
  target: Pick<IndexTransaction, "installmentPeriod" | "date"> & {
    seriesParentDate?: string | null;
  };
  context: InstallmentRevisionSeriesContext;
  parentDate?: string | null;
  periodMonths?: number;
}): number | null => {
  const period = periodMonths ?? target.installmentPeriod ?? 0;
  const anchorDate = getLocalIsoDateKey(
    parentDate?.trim()
    || target.seriesParentDate?.trim()
    || target.date,
  );

  if (period <= 0 || !anchorDate) {
    return null;
  }

  return (
    computeInstallmentCommitmentTotalCents({
      parentDate: anchorDate,
      period,
      defaultPerPaymentCents: context.defaultPerPaymentCents,
      occurrenceCentsByDate: context.occurrenceCentsByDate,
    }) / 100
  );
};

export const withInstallmentPlanRevisionSubmit = <T extends UpdateTransactionType>(
  original: UpdateTransactionType,
  newData: T,
  scope: UpdateScope,
): T => {
  if (!needsInstallmentPlanRevision(original, newData, scope)) {
    return newData;
  }

  return {
    ...newData,
    installmentPeriod: resolveInstallmentRevisionPeriod(newData, original),
    installmentRevisionAnchor: "explicit",
  } as T;
};
