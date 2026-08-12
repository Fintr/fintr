import { extractAccountsFromResponse } from "@/services/transactions/accounts/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import type {
  AccountBalanceTimeline,
  AccountBalanceTimelinePoint,
  FetchAccountBalanceTimelineParams,
} from "@/services/transactions/accountBalanceTimeline";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const DEFAULT_MAX_POINTS = 60;

const parseBalance = (value: string | number | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareTransactionsAscending = (
  left: IndexTransaction,
  right: IndexTransaction,
): number => {
  const leftDate = left.date.slice(0, 10);
  const rightDate = right.date.slice(0, 10);

  if (leftDate !== rightDate) {
    return leftDate < rightDate ? -1 : 1;
  }

  const leftCreated = left.createdAt ?? left.date;
  const rightCreated = right.createdAt ?? right.date;

  return leftCreated < rightCreated ? -1 : leftCreated > rightCreated ? 1 : 0;
};

const signedBalanceEffect = (
  transaction: IndexTransaction,
  accountName: string,
): number => {
  const normalizedAccount = accountName.trim().toLowerCase();
  const from = (transaction.fromAccountName ?? "").trim().toLowerCase();
  const to = (transaction.toAccountName ?? "").trim().toLowerCase();
  const amount = Math.abs(parseBalance(transaction.amount));

  if (amount === 0) {
    return 0;
  }

  switch (transaction.type) {
    case CombinedTransactionTypeEnum.INCOME:
      return to === normalizedAccount ? amount : 0;
    case CombinedTransactionTypeEnum.EXPENSE:
      return from === normalizedAccount ? -amount : 0;
    case CombinedTransactionTypeEnum.TRANSFER:
      if (from === normalizedAccount && to === normalizedAccount) {
        return 0;
      }

      if (from === normalizedAccount) {
        return -amount;
      }

      if (to === normalizedAccount) {
        return amount;
      }

      return 0;
    case CombinedTransactionTypeEnum.LOAN_DISBURSEMENT:
      return to === normalizedAccount ? amount : 0;
    case CombinedTransactionTypeEnum.LOAN_PAYMENT:
      return from === normalizedAccount ? -amount : 0;
    default:
      return 0;
  }
};

const transactionTouchesAccount = (
  transaction: IndexTransaction,
  accountName: string,
): boolean => {
  const normalizedAccount = accountName.trim().toLowerCase();
  const from = (transaction.fromAccountName ?? "").trim().toLowerCase();
  const to = (transaction.toAccountName ?? "").trim().toLowerCase();

  return from === normalizedAccount || to === normalizedAccount;
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

  const accountName = account.name;
  const currentBalance = parseBalance(account.balance);
  const currency = account.balanceCurrency ?? "PHP";
  const maxPoints = params.maxPoints ?? DEFAULT_MAX_POINTS;

  const rows = await loadCachedTransactionsInRange(
    spaceCode,
    params.startDate,
    params.endDate,
  );

  const activities = rows
    .filter((row) => transactionTouchesAccount(row, accountName))
    .sort(compareTransactionsAscending);

  if (activities.length === 0) {
    return {
      currency,
      points: [
        {
          date: params.startDate,
          balance: currentBalance,
          change: null,
        },
      ],
    };
  }

  const signedEffects = activities.map((activity) =>
    signedBalanceEffect(activity, accountName),
  );
  const totalEffect = signedEffects.reduce((sum, value) => sum + value, 0);
  const openingBalance = currentBalance - totalEffect;
  const points: AccountBalanceTimelinePoint[] = [];

  points.push({
    date: params.startDate,
    balance: openingBalance,
    change: null,
  });

  let running = openingBalance;

  activities.forEach((activity, index) => {
    const signed = signedEffects[index] ?? 0;
    running += signed;

    points.push({
      date: activity.date.slice(0, 10),
      occurredAt: activity.createdAt ?? activity.date,
      balance: running,
      change: signed,
    });
  });

  return {
    currency,
    points: downsamplePoints(points, maxPoints),
  };
};
