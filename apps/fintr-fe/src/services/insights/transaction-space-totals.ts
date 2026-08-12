import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import type { InsightsSummary } from "./types";
import {
  type ExchangeRateLookup,
  preloadExchangeRatesForTransactions,
  toSpaceDecimal,
} from "./space-currency-amount";

const toNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

type CurrencyConversionLike = {
  originalAmount?: number;
  originalCurrency?: string;
};

const readCurrencyConversion = (
  transaction: IndexTransaction,
): CurrencyConversionLike | undefined => {
  const extended = transaction as IndexTransaction & {
    currencyConversion?: CurrencyConversionLike;
  };

  return extended.currencyConversion;
};

/**
 * Prefer booked→space FX using IndexedDB rates (see preloadExchangeRatesForTransactions).
 * When no cached rate exists, fall back to list `amount` (space currency from API).
 */
export const amountNumericForSpaceTotal = (
  transaction: IndexTransaction,
  spaceCurrency: string,
  rateLookup?: ExchangeRateLookup,
): number => {
  const space = normalizeCurrency(spaceCurrency || "PHP");
  const conversion = readCurrencyConversion(transaction);
  const displayAmount = toNumber(transaction.amount);

  if (
    conversion?.originalCurrency
    && normalizeCurrency(conversion.originalCurrency) === space
    && conversion.originalAmount != null
  ) {
    const original = toNumber(conversion.originalAmount);
    const sign =
      displayAmount < 0 ? -1 : displayAmount > 0 ? 1 : 1;

    return Number((sign * Math.abs(original)).toFixed(2));
  }

  const bookedAmount =
    transaction.bookedAmount != null
      ? toNumber(transaction.bookedAmount)
      : displayAmount;
  const bookedCurrency = normalizeCurrency(
    transaction.bookedAmountCurrency
    ?? transaction.amountCurrency
    ?? space,
  );
  const date = transaction.date.slice(0, 10);

  if (bookedCurrency === space) {
    return Number(bookedAmount.toFixed(2));
  }

  const converted = toSpaceDecimal({
    amount: bookedAmount,
    fromCurrency: bookedCurrency,
    date,
    spaceCurrency: space,
    rateLookup,
    strict: true,
  });

  if (converted !== 0) {
    return converted;
  }

  if (displayAmount !== 0) {
    return Number(displayAmount.toFixed(2));
  }

  return 0;
};

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = date.slice(0, 10);
  return key >= startDate && key <= endDate;
};

const isIncome = (transaction: IndexTransaction): boolean =>
  transaction.type === CombinedTransactionTypeEnum.INCOME;

const isExpense = (transaction: IndexTransaction): boolean =>
  transaction.type === CombinedTransactionTypeEnum.EXPENSE;

/**
 * Mirrors MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange —
 * group by booked currency + date, sum native amounts, convert grouped totals.
 */
export const aggregateTotalsInSpaceForRange = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
  spaceCurrency: string,
  rateLookup?: ExchangeRateLookup,
): InsightsSummary => {
  const space = normalizeCurrency(spaceCurrency || "PHP");

  const sumTypeInSpace = (type: "income" | "expense"): number => {
    const groups = new Map<string, { currency: string; date: string; total: number }>();

    for (const transaction of transactions) {
      if (type === "income" && !isIncome(transaction)) {
        continue;
      }
      if (type === "expense" && !isExpense(transaction)) {
        continue;
      }

      const date = transaction.date.slice(0, 10);
      if (!transactionInDateRange(date, startDate, endDate)) {
        continue;
      }

      const currency = normalizeCurrency(
        transaction.bookedAmountCurrency
        ?? transaction.amountCurrency
        ?? space,
      );
      const nativeAmount =
        transaction.bookedAmount != null
          ? toNumber(transaction.bookedAmount)
          : toNumber(transaction.amount);
      const groupKey = `${currency}:${date}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.total += nativeAmount;
      } else {
        groups.set(groupKey, {
          currency,
          date,
          total: nativeAmount,
        });
      }
    }

    let sum = 0;

    for (const group of groups.values()) {
      if (group.total === 0) {
        continue;
      }

      const converted = toSpaceDecimal({
        amount: type === "expense" ? Math.abs(group.total) : group.total,
        fromCurrency: group.currency,
        date: group.date,
        spaceCurrency: space,
        rateLookup,
        strict: true,
      });

      sum += converted;
    }

    return sum;
  };

  const totalIncome = sumTypeInSpace("income");
  const totalExpenses = sumTypeInSpace("expense");

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
  };
};

/**
 * Mirrors Insights::Operations::CreateSummaryStructure#totals_from_transactions.
 */
export const summaryFromTransactionsForSpace = (
  transactions: IndexTransaction[],
  spaceCurrency: string,
  rateLookup?: ExchangeRateLookup,
): InsightsSummary => {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const transaction of transactions) {
    const amount = amountNumericForSpaceTotal(
      transaction,
      spaceCurrency,
      rateLookup,
    );

    if (isIncome(transaction)) {
      totalIncome += amount;
    } else if (isExpense(transaction)) {
      totalExpenses += Math.abs(amount);
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
  };
};

export const buildTransactionTotalsContext = async (params: {
  spaceCode: string;
  spaceCurrency: string;
  transactions: IndexTransaction[];
}): Promise<{
  rateLookup: ExchangeRateLookup;
  summaryFromTransactions: (
    transactions: IndexTransaction[],
  ) => InsightsSummary;
  aggregateTotalsInSpaceForRange: (
    transactions: IndexTransaction[],
    startDate: string,
    endDate: string,
  ) => InsightsSummary;
}> => {
  const rateLookup = await preloadExchangeRatesForTransactions({
    spaceCode: params.spaceCode,
    spaceCurrency: params.spaceCurrency,
    transactions: params.transactions,
  });

  return {
    rateLookup,
    summaryFromTransactions: (rows: IndexTransaction[]) =>
      summaryFromTransactionsForSpace(
        rows,
        params.spaceCurrency,
        rateLookup,
      ),
    aggregateTotalsInSpaceForRange: (
      rows: IndexTransaction[],
      startDate: string,
      endDate: string,
    ) =>
      aggregateTotalsInSpaceForRange(
        rows,
        startDate,
        endDate,
        params.spaceCurrency,
        rateLookup,
      ),
  };
};
