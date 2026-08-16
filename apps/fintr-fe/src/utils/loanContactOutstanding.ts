export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type LoanContactOutstanding = {
  youOwe: CurrencyAmount[];
  theyOwe: CurrencyAmount[];
};

type LoanOutstandingInput = {
  loanType: "borrowed" | "lent";
  outstandingBalance: number;
  currency: string;
};

const addByCurrency = (
  rows: CurrencyAmount[],
  currency: string,
  amount: number,
) => {
  const existing = rows.find((row) => row.currency === currency);
  if (existing) {
    existing.amount += amount;
    return;
  }

  rows.push({ currency, amount });
};

export const loanContactOutstanding = (
  loans: LoanOutstandingInput[],
): LoanContactOutstanding => {
  const youOwe: CurrencyAmount[] = [];
  const theyOwe: CurrencyAmount[] = [];

  for (const loan of loans) {
    if (loan.outstandingBalance <= 0) {
      continue;
    }

    if (loan.loanType === "borrowed") {
      addByCurrency(youOwe, loan.currency, loan.outstandingBalance);
    } else {
      addByCurrency(theyOwe, loan.currency, loan.outstandingBalance);
    }
  }

  return {
    youOwe,
    theyOwe,
  };
};
