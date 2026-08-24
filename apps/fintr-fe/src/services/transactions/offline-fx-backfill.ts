import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import type {
  CurrencyConversionType,
  IndexTransaction,
} from "@/types/transactionTypes";
import { positiveTransactionFormAmount } from "@/utils/transactionFormAmount";
import { conversionHasFx, reconcileFxConversion } from "@/utils/transactionViewMoney";

const nearlyEqualMoney = (left: number, right: number): boolean => {
  if (left === right) {
    return true;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) < 0.05 || Math.abs(left - right) / scale < 0.002;
};

export const listRowHasCrossCurrencyBooked = (
  listRow: IndexTransaction,
): boolean => {
  const bookedCurrency = listRow.bookedAmountCurrency?.trim().toUpperCase();
  const amountCurrency = listRow.amountCurrency?.trim().toUpperCase();

  return Boolean(
    listRow.bookedAmount != null
    && bookedCurrency
    && amountCurrency
    && bookedCurrency !== amountCurrency,
  );
};

const buildCurrencyConversionFromBookedLegs = (
  row: IndexTransaction,
  existing?: CurrencyConversionType | null,
): CurrencyConversionType => {
  const bookedAmount = positiveTransactionFormAmount(row.bookedAmount);
  const bookedCurrency = row.bookedAmountCurrency!;
  const listAmount = positiveTransactionFormAmount(row.amount);
  const convertedCurrency = row.amountCurrency ?? "PHP";
  const inferredRate =
    bookedAmount !== 0
    && !nearlyEqualMoney(listAmount, bookedAmount)
      ? listAmount / bookedAmount
      : null;

  return {
    originalAmount: bookedAmount,
    originalCurrency: bookedCurrency,
    convertedAmount: listAmount,
    convertedCurrency,
    exchangeRate:
      existing?.exchangeRate
      ?? inferredRate
      ?? 1,
    source: existing?.source ?? "manual",
    rateTimestamp: existing?.rateTimestamp,
    note: existing?.note ?? null,
  };
};

export const indexRowHasStoredFx = (row: IndexTransaction): boolean =>
  listRowHasCrossCurrencyBooked(row)
  || conversionHasFx(row.currencyConversion);

/**
 * Ensure every offline index row carries a persisted `currencyConversion`
 * object (not just booked legs) so edit/detail paths can read IndexedDB alone.
 */
export const backfillIndexRowForOffline = (
  row: IndexTransaction,
): IndexTransaction => {
  if (conversionHasFx(row.currencyConversion)) {
    const reconciled = reconcileFxConversion(row.currencyConversion!, {
      amount: row.bookedAmount,
      currency: row.bookedAmountCurrency,
    });

    if (reconciled === row.currencyConversion) {
      return row;
    }

    return {
      ...row,
      currencyConversion: reconciled,
    };
  }

  if (!listRowHasCrossCurrencyBooked(row)) {
    return row;
  }

  return {
    ...row,
    currencyConversion: reconcileFxConversion(
      buildCurrencyConversionFromBookedLegs(
        row,
        row.currencyConversion,
      ),
      {
        amount: row.bookedAmount,
        currency: row.bookedAmountCurrency,
      },
    ),
  };
};

/** Installment / series rows that still need a full API detail fetch for FX. */
export const indexRowNeedsFxDetailPrefetch = (
  row: IndexTransaction,
): boolean => {
  if (indexRowHasStoredFx(row)) {
    return false;
  }

  return (
    row.scheduleType === ScheduleTypeEnum.INSTALLMENT
    || (row.installmentPeriod ?? 0) > 0
    || Boolean(row.parentId)
    || Boolean(row.inSeries)
  );
};

export const backfillIndexRowsForOffline = (
  rows: IndexTransaction[],
): IndexTransaction[] => rows.map(backfillIndexRowForOffline);
