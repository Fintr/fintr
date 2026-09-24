import { Loan } from "@/services/loans/queries";
import { isActiveLoanWithBalance } from "@/utils/loan-upcoming-deadlines";

export type LoanEntityBalanceDirection = "you_owe" | "they_owe" | "settled";

export type LoanEntityCurrencyBalance = {
  currency: string;
  borrowedAmount: number;
  lentAmount: number;
  netAmount: number;
  direction: LoanEntityBalanceDirection;
};

export type LoanEntityProfile = {
  entityName: string;
  entityKey: string;
  balances: LoanEntityCurrencyBalance[];
  primaryBalance: LoanEntityCurrencyBalance;
  loanCount: number;
};

const parseAmount = (value: number | string): number => {
  if (typeof value === "string") {
    return parseFloat(value);
  }

  return value;
};

const normalizeEntityKey = (entityName: string): string =>
  entityName.trim().toLowerCase();

const directionFromNet = (netAmount: number): LoanEntityBalanceDirection => {
  if (netAmount > 0.01) {
    return "they_owe";
  }

  if (netAmount < -0.01) {
    return "you_owe";
  }

  return "settled";
};

const buildCurrencyBalance = ({
  currency,
  borrowedAmount,
  lentAmount,
}: {
  currency: string;
  borrowedAmount: number;
  lentAmount: number;
}): LoanEntityCurrencyBalance => {
  const netAmount = lentAmount - borrowedAmount;

  return {
    currency,
    borrowedAmount,
    lentAmount,
    netAmount,
    direction: directionFromNet(netAmount),
  };
};

const pickPrimaryBalance = (
  balances: LoanEntityCurrencyBalance[],
): LoanEntityCurrencyBalance => {
  return [...balances].sort((left, right) => {
    const absDiff = Math.abs(right.netAmount) - Math.abs(left.netAmount);
    if (absDiff !== 0) {
      return absDiff;
    }

    return left.currency.localeCompare(right.currency);
  })[0];
};

/**
 * Aggregates active loan balances by counterparty entity.
 * Net = lent outstanding − borrowed outstanding (positive means they owe you).
 */
export const buildLoanEntityProfiles = (loans: Loan[]): LoanEntityProfile[] => {
  type Acc = {
    entityName: string;
    entityKey: string;
    loanCount: number;
    byCurrency: Map<
      string,
      {
        borrowedAmount: number;
        lentAmount: number;
      }
    >;
  };

  const byEntity = new Map<string, Acc>();

  for (const loan of loans) {
    if (!isActiveLoanWithBalance(loan)) {
      continue;
    }

    const entityName = loan.entityName?.trim();
    if (!entityName) {
      continue;
    }

    const entityKey = normalizeEntityKey(entityName);
    const currency = loan.outstandingBalanceCurrency || "PHP";
    const amount = parseAmount(loan.outstandingBalance);
    const existing = byEntity.get(entityKey);

    if (!existing) {
      const byCurrency = new Map<
        string,
        {
          borrowedAmount: number;
          lentAmount: number;
        }
      >();
      byCurrency.set(currency, {
        borrowedAmount: loan.loanType === "borrowed" ? amount : 0,
        lentAmount: loan.loanType === "lent" ? amount : 0,
      });
      byEntity.set(entityKey, {
        entityName,
        entityKey,
        loanCount: 1,
        byCurrency,
      });
      continue;
    }

    existing.loanCount += 1;
    const currencyTotals = existing.byCurrency.get(currency) ?? {
      borrowedAmount: 0,
      lentAmount: 0,
    };

    if (loan.loanType === "borrowed") {
      currencyTotals.borrowedAmount += amount;
    } else {
      currencyTotals.lentAmount += amount;
    }

    existing.byCurrency.set(currency, currencyTotals);
  }

  const profiles: LoanEntityProfile[] = [];

  for (const entry of byEntity.values()) {
    const balances = Array.from(entry.byCurrency.entries())
      .map(([currency, totals]) =>
        buildCurrencyBalance({
          currency,
          borrowedAmount: totals.borrowedAmount,
          lentAmount: totals.lentAmount,
        }),
      )
      .filter((balance) => Math.abs(balance.netAmount) > 0.01)
      .sort((left, right) => left.currency.localeCompare(right.currency));

    if (balances.length === 0) {
      continue;
    }

    profiles.push({
      entityName: entry.entityName,
      entityKey: entry.entityKey,
      balances,
      primaryBalance: pickPrimaryBalance(balances),
      loanCount: entry.loanCount,
    });
  }

  return profiles.sort((left, right) => {
    const absDiff =
      Math.abs(right.primaryBalance.netAmount) -
      Math.abs(left.primaryBalance.netAmount);
    if (absDiff !== 0) {
      return absDiff;
    }

    return left.entityName.localeCompare(right.entityName);
  });
};
