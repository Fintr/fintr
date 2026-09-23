import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import {
  allocateCostShare,
  assertAllocateCostShare,
  type AllocateCostShareInput,
  type CostShareAllocation,
  type CostShareMode,
  type CostShareParticipantInput,
} from "@fintr/domain";

import { applyLocalTransactionsToAccountBalances } from "@/services/transactions/accounts/account-cache-ops";
import {
  createLoanLocalFirst,
  type CreateLoanLocalFirstResult,
} from "@/services/loans/create-local-first";

import {
  createTransactionLocalFirst,
  optimisticIndexMoneyFromCreate,
  type CreateTransactionLocalFirstOptions,
  type CreateTransactionLocalFirstResult,
} from "./create-local-first";
import type { CreateTransactionType } from "./mutation";

export const COST_SHARE_LOAN_TERM_MONTHS = 1;

export type ExpenseCostShareInput = {
  mode: CostShareMode;
  participants: CostShareParticipantInput[];
};

export type CreateExpenseWithCostShareParams = {
  spaceId: string;
  data: CreateTransactionType;
  costShare: ExpenseCostShareInput;
  entryCurrency?: string;
  spaceCurrency?: string;
  amountCurrency?: string;
};

export type CreateExpenseWithCostShareLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  allocation: CostShareAllocation;
  expense: CreateTransactionLocalFirstResult;
  loans: CreateLoanLocalFirstResult[];
  syncPromise: Promise<CreateExpenseWithCostShareLocalFirstResult>;
};

const costShareLoanDescription = (description?: string): string => {
  const trimmed = description?.trim() ?? "";
  return trimmed.length > 0 ? `Share of ${trimmed}` : "Share of expense";
};

const buildAllocationInput = (
  totalAmount: number,
  costShare: ExpenseCostShareInput,
): AllocateCostShareInput => ({
  totalAmount,
  mode: costShare.mode,
  participants: costShare.participants,
});

export const createExpenseWithCostShareLocalFirst = async (
  api: AxiosInstance,
  params: CreateExpenseWithCostShareParams,
  options: CreateTransactionLocalFirstOptions = {},
): Promise<CreateExpenseWithCostShareLocalFirstResult> => {
  const { spaceId, data, costShare } = params;
  const { queryClient, waitForSync = true } = options;
  const shareMoney = (amount: number) =>
    optimisticIndexMoneyFromCreate({
      occurrenceAmount: amount,
      data,
      entryCurrency: params.entryCurrency,
      spaceCurrency: params.spaceCurrency,
    });

  assertAllocateCostShare(buildAllocationInput(data.amount, costShare));
  const allocation = allocateCostShare(
    buildAllocationInput(data.amount, costShare),
  );

  const expense = await createTransactionLocalFirst(
    api,
    {
      spaceId,
      data: {
        ...data,
        amount: allocation.yourShare,
      },
      entryCurrency: params.entryCurrency,
      spaceCurrency: params.spaceCurrency,
      amountCurrency: params.amountCurrency,
    },
    {
      ...options,
      waitForSync: false,
    },
  );

  const loans: CreateLoanLocalFirstResult[] = [];
  for (const participant of allocation.participants) {
    const loanMoney = shareMoney(participant.amount);
    const loan = await createLoanLocalFirst(
      api,
      {
        spaceId,
        data: {
          principalAmount: loanMoney.amount,
          interestRate: 0,
          date: data.date,
          loanType: "lent",
          entityName: participant.entityName,
          accountName: data.accountName,
          loanTermMonths: COST_SHARE_LOAN_TERM_MONTHS,
          description: costShareLoanDescription(data.description),
          adjustsAccountBalance: true,
        },
      },
      {
        queryClient,
        waitForSync: false,
        amountCurrency:
          loanMoney.amountCurrency
          ?? params.spaceCurrency
          ?? params.amountCurrency,
      },
    );
    loans.push(loan);
  }

  await applyLocalTransactionsToAccountBalances({
    spaceId,
    transactions: loans.map((loan) => loan.localTransaction),
    mode: "apply",
    queryClient,
  });

  const pendingSync = expense.pendingSync || loans.some((loan) => loan.pendingSync);

  const assemble = (
    nextExpense: CreateTransactionLocalFirstResult,
    nextLoans: CreateLoanLocalFirstResult[],
  ): CreateExpenseWithCostShareLocalFirstResult => ({
    data: nextExpense.data,
    pendingSync: nextExpense.pendingSync || nextLoans.some((loan) => loan.pendingSync),
    allocation,
    expense: nextExpense,
    loans: nextLoans,
    syncPromise,
  });

  const syncPromise = (async () => {
    const nextExpense = await expense.syncPromise;
    const nextLoans = await Promise.all(loans.map((loan) => loan.syncPromise));
    return assemble(nextExpense, nextLoans);
  })();

  const localResult = assemble(expense, loans);
  localResult.pendingSync = pendingSync;

  if (waitForSync) {
    return syncPromise;
  }

  return localResult;
};
