import { format, parseISO, subDays } from "date-fns";

import { extractAccountsFromResponse } from "@/services/transactions/accounts/local-cache";
import {
  preloadExchangeRatesForTransactions,
  toSpaceDecimal,
  type ExchangeRateLookup,
} from "@/services/insights/space-currency-amount";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import type {
  AccountBalanceTimeline,
  AccountBalanceTimelinePoint,
  FetchAccountBalanceTimelineParams,
} from "@/services/transactions/accountBalanceTimeline";
import type { Account } from "@/types/accountTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const DEFAULT_MAX_POINTS = 60;

const parseBalance = (value: string | number | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrency = (code: string | undefined): string =>
  (code ?? "").trim().toUpperCase();

const dateKey = (value: string): string => value.slice(0, 10);

const compareTransactionsAscending = (
  left: IndexTransaction,
  right: IndexTransaction,
): number => {
  const leftDate = dateKey(left.date);
  const rightDate = dateKey(right.date);

  if (leftDate !== rightDate) {
    return leftDate < rightDate ? -1 : 1;
  }

  const leftCreated = left.createdAt ?? left.date;
  const rightCreated = right.createdAt ?? right.date;

  return leftCreated < rightCreated ? -1 : leftCreated > rightCreated ? 1 : 0;
};

const namesMatch = (left: string | undefined, right: string): boolean =>
  (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();

const idsMatch = (left: string | null | undefined, right: string): boolean =>
  Boolean(left) && left === right;

const isFromAccount = (
  transaction: IndexTransaction,
  account: Account,
): boolean => {
  if (idsMatch(transaction.fromAccountId, account.id)) {
    return true;
  }

  if (transaction.fromAccountId) {
    return false;
  }

  return namesMatch(transaction.fromAccountName, account.name);
};

const isToAccount = (
  transaction: IndexTransaction,
  account: Account,
): boolean => {
  if (idsMatch(transaction.toAccountId, account.id)) {
    return true;
  }

  if (transaction.toAccountId) {
    return false;
  }

  return namesMatch(transaction.toAccountName, account.name);
};

export const transactionTouchesAccount = (
  transaction: IndexTransaction,
  account: Account,
): boolean => {
  if (idsMatch(transaction.accountId, account.id)) {
    return true;
  }

  return isFromAccount(transaction, account) || isToAccount(transaction, account);
};

const magnitudeInAccountCurrency = (
  transaction: IndexTransaction,
  accountCurrency: string,
  rateLookup?: ExchangeRateLookup,
): number => {
  const target = normalizeCurrency(accountCurrency) || "PHP";
  const displayAmount = Math.abs(parseBalance(transaction.amount));
  const amountCurrency = normalizeCurrency(transaction.amountCurrency);
  const bookedAmount = Math.abs(
    parseBalance(transaction.bookedAmount ?? transaction.amount),
  );
  const bookedCurrency = normalizeCurrency(
    transaction.bookedAmountCurrency ?? transaction.amountCurrency,
  );
  const spaceAmount = transaction.amountInSpaceCurrency;

  if (amountCurrency === target && displayAmount !== 0) {
    return Number(displayAmount.toFixed(2));
  }

  if (bookedCurrency === target && bookedAmount !== 0) {
    return Number(bookedAmount.toFixed(2));
  }

  if (
    spaceAmount &&
    normalizeCurrency(spaceAmount.currency) === target &&
    Number.isFinite(spaceAmount.amount)
  ) {
    return Number(Math.abs(spaceAmount.amount).toFixed(2));
  }

  const fromCurrency = bookedCurrency || amountCurrency || target;
  const sourceAmount = bookedAmount || displayAmount;

  return Math.abs(
    toSpaceDecimal({
      amount: sourceAmount,
      fromCurrency,
      date: dateKey(transaction.date),
      spaceCurrency: target,
      rateLookup,
      strict: false,
    }),
  );
};

export const signedAccountBalanceEffect = (
  transaction: IndexTransaction,
  account: Account,
  rateLookup?: ExchangeRateLookup,
): number => {
  const from = isFromAccount(transaction, account);
  const to = isToAccount(transaction, account);

  if (!from && !to && !idsMatch(transaction.accountId, account.id)) {
    return 0;
  }

  const amount = magnitudeInAccountCurrency(
    transaction,
    account.balanceCurrency,
    rateLookup,
  );

  if (amount === 0) {
    return 0;
  }

  switch (transaction.type) {
    case CombinedTransactionTypeEnum.INCOME:
      return to ? amount : 0;
    case CombinedTransactionTypeEnum.EXPENSE:
      return from ? -amount : 0;
    case CombinedTransactionTypeEnum.TRANSFER:
      if (from && to) {
        return 0;
      }

      if (from) {
        return -amount;
      }

      if (to) {
        return amount;
      }

      return 0;
    case CombinedTransactionTypeEnum.LOAN_DISBURSEMENT:
      if (transaction.loanType === "lent") {
        return -amount;
      }

      if (transaction.loanType === "borrowed") {
        return amount;
      }

      return to ? amount : from ? -amount : 0;
    case CombinedTransactionTypeEnum.LOAN_PAYMENT:
      if (transaction.loanType === "lent") {
        return amount;
      }

      if (transaction.loanType === "borrowed") {
        return -amount;
      }

      return from ? -amount : to ? amount : 0;
    default:
      return 0;
  }
};

const downsamplePoints = (
  points: AccountBalanceTimelinePoint[],
  maxPoints: number,
): AccountBalanceTimelinePoint[] => {
  if (points.length <= maxPoints) {
    return points;
  }

  const indices = [0];

  if (maxPoints > 2) {
    const stepSize = (points.length - 1) / (maxPoints - 1);

    for (let index = 1; index < maxPoints - 1; index += 1) {
      indices.push(Math.round(index * stepSize));
    }
  }

  indices.push(points.length - 1);

  return [...new Set(indices)]
    .sort((left, right) => left - right)
    .map((index) => points[index]);
};

const dayBefore = (date: string): string =>
  format(subDays(parseISO(date), 1), "yyyy-MM-dd");

const accountHasPriorActivity = async (
  spaceCode: string,
  account: Account,
  startDate: string,
): Promise<boolean> => {
  const priorEndDate = dayBefore(startDate);

  if (priorEndDate >= startDate) {
    return false;
  }

  const priorRows = await loadCachedTransactionsInRange(
    spaceCode,
    "0000-01-01",
    priorEndDate,
  );

  return priorRows.some(
    (row) =>
      dateKey(row.date) < startDate && transactionTouchesAccount(row, account),
  );
};

export const buildAccountBalanceTimelineFromCache = async (
  spaceCode: string,
  accountsResponse: unknown,
  accountId: string,
  params: FetchAccountBalanceTimelineParams,
): Promise<AccountBalanceTimeline | undefined> => {
  if (!spaceCode || !accountId) {
    return undefined;
  }

  const accounts = extractAccountsFromResponse(accountsResponse);
  const account = accounts.find((row) => row.id === accountId);

  if (!account) {
    return undefined;
  }

  const currentBalance = parseBalance(account.balance);
  const currency = account.balanceCurrency ?? "PHP";
  const maxPoints = params.maxPoints ?? DEFAULT_MAX_POINTS;
  const startDate = dateKey(params.startDate);
  const endDate = dateKey(params.endDate);

  const rows = await loadCachedTransactionsInRange(
    spaceCode,
    startDate,
    endDate,
  );

  const activities = rows
    .filter((row) => transactionTouchesAccount(row, account))
    .sort(compareTransactionsAscending);

  const rateLookup = await preloadExchangeRatesForTransactions({
    spaceCode,
    spaceCurrency: currency,
    transactions: activities,
  });

  if (activities.length === 0) {
    return {
      currency,
      points: [
        {
          date: startDate,
          occurredAt: startDate,
          balance: currentBalance,
          change: null,
        },
      ],
    };
  }

  const signedEffects = activities.map((activity) =>
    signedAccountBalanceEffect(activity, account, rateLookup),
  );
  const totalEffect = signedEffects.reduce((sum, value) => sum + value, 0);
  const openingBalance = currentBalance - totalEffect;
  const hasPriorActivity = await accountHasPriorActivity(
    spaceCode,
    account,
    startDate,
  );
  const points: AccountBalanceTimelinePoint[] = [];

  if (hasPriorActivity) {
    points.push({
      date: startDate,
      occurredAt: startDate,
      balance: openingBalance,
      change: null,
    });
  }

  let running = openingBalance;

  activities.forEach((activity, index) => {
    const signed = signedEffects[index] ?? 0;
    running += signed;
    const activityDate = dateKey(activity.date);

    points.push({
      date: activityDate,
      occurredAt: activityDate,
      balance: Number(running.toFixed(2)),
      change: Number(signed.toFixed(2)),
    });
  });

  return {
    currency,
    points: downsamplePoints(points, maxPoints),
  };
};
