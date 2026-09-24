import { toLedgerCents } from "@fintr/domain";
import type { IndexTransaction } from "@/types/transactionTypes";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const nearlyEqualMoney = (left: number, right: number): boolean =>
  Math.abs(left - right) < 0.005;

export const indexRowLedgerAmountCents = (
  row: Pick<
    IndexTransaction,
    "amount" | "bookedAmount" | "bookedAmountCurrency" | "amountCurrency" | "currencyConversion"
  >,
): number => {
  const spaceAmount = Math.abs(Number(row.amount) || 0);
  const bookedAmount =
    row.bookedAmount != null
      ? Math.abs(Number(row.bookedAmount))
      : null;
  const bookedCurrency = normalizeCurrency(row.bookedAmountCurrency ?? "");
  const spaceCurrency = normalizeCurrency(row.amountCurrency ?? "");
  const storedRate = Number(row.currencyConversion?.exchangeRate);
  const inferredRate =
    bookedAmount != null
    && bookedAmount > 0
    && spaceAmount > 0
    && !nearlyEqualMoney(spaceAmount, bookedAmount)
      ? spaceAmount / bookedAmount
      : 0;
  const rate = storedRate > 1.001 ? storedRate : inferredRate;

  if (
    bookedAmount != null
    && bookedCurrency
    && spaceCurrency
    && bookedCurrency !== spaceCurrency
    && rate > 1.001
    && nearlyEqualMoney(spaceAmount, bookedAmount)
  ) {
    return Math.round(bookedAmount * rate * 100);
  }

  return Math.round(spaceAmount * 100);
};

export const buildLedgerOccurrenceCentsByDate = (
  rows: IndexTransaction[],
): Record<string, number> =>
  rows.reduce<Record<string, number>>((amounts, row) => {
    amounts[getLocalIsoDateKey(row.date)] = indexRowLedgerAmountCents(row);
    return amounts;
  }, {});

export const convertDisplayOccurrenceCentsToLedger = (
  occurrenceCentsByDate: Record<string, number>,
  exchangeRate: number,
): Record<string, number> => {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 1.001) {
    return occurrenceCentsByDate;
  }

  return Object.fromEntries(
    Object.entries(occurrenceCentsByDate).map(([date, cents]) => [
      date,
      Math.round(cents * exchangeRate),
    ]),
  );
};

export const resolvePlanTotalLedgerCents = ({
  planTotal,
  originalCurrency,
  exchangeRate,
  spaceCurrency,
}: {
  planTotal: number;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  spaceCurrency?: string | null;
}): number => {
  const parsed = Number(planTotal);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return toLedgerCents({
    amount: parsed,
    fromCurrency: originalCurrency,
    ledgerCurrency: spaceCurrency,
    exchangeRate,
  });
};

export const resolveInstallmentRevisionFx = ({
  originalCurrency,
  exchangeRate,
  spaceCurrency,
  storedOriginalCurrency,
  storedConvertedCurrency,
  storedExchangeRate,
}: {
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  spaceCurrency: string;
  storedOriginalCurrency?: string | null;
  storedConvertedCurrency?: string | null;
  storedExchangeRate?: number | null;
}): {
  originalCurrency: string;
  ledgerCurrency: string;
  exchangeRate: number;
} => {
  const from = (
    originalCurrency
    || storedOriginalCurrency
    || spaceCurrency
  ).trim();
  const converted = (
    storedConvertedCurrency
    || spaceCurrency
  ).trim();
  const rateFromSubmit = Number(exchangeRate);
  const rateFromStore = Number(storedExchangeRate);
  const rate =
    rateFromSubmit > 0
      ? rateFromSubmit
      : rateFromStore > 0
        ? rateFromStore
        : 1;
  const currenciesDiffer =
    Boolean(from)
    && Boolean(converted)
    && normalizeCurrency(from) !== normalizeCurrency(converted);

  return {
    originalCurrency: from || spaceCurrency,
    ledgerCurrency: currenciesDiffer ? converted : spaceCurrency,
    exchangeRate: rate,
  };
};

export const ledgerPerPaymentToBookedAmount = ({
  perPaymentLedger,
  exchangeRate,
  originalCurrency,
  ledgerCurrency,
}: {
  perPaymentLedger: number;
  exchangeRate: number;
  originalCurrency?: string | null;
  ledgerCurrency?: string | null;
}): number => {
  const from = originalCurrency?.trim().toUpperCase() ?? "";
  const ledger = ledgerCurrency?.trim().toUpperCase() ?? "";
  if (from && ledger && from === ledger) {
    return perPaymentLedger;
  }

  if (!Number.isFinite(exchangeRate) || exchangeRate <= 1.001) {
    return perPaymentLedger;
  }

  return roundMoney(perPaymentLedger / exchangeRate);
};
