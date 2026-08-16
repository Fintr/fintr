import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import { listSpaceTransactions } from "@/lib/local-db/transactions";
import {
  loadCachedLoanPayments,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";
import type {
  EntityDetail,
  EntityDetailLoan,
  EntityDetailLoanPayment,
  EntityRecord,
} from "@/services/entities/mutation";

const entitiesKey = (spaceCode: string): string => `entities:${spaceCode}`;

export const normalizeEntityRecord = (
  entity: Record<string, unknown>,
): EntityRecord => ({
  id: String(entity.id ?? ""),
  fullName: String(entity.fullName ?? entity.full_name ?? ""),
  entityType: (entity.entityType ?? entity.entity_type ?? "loan") as
    | "loan"
    | "transaction",
  photoUrl:
    (entity.photoUrl ?? entity.photo_url ?? null) as string | null | undefined,
});

export const normalizeEntityRecords = (
  rows: unknown,
): EntityRecord[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) =>
    normalizeEntityRecord((row ?? {}) as Record<string, unknown>),
  );
};

export const filterCachedEntities = (
  entities: EntityRecord[],
  entityType: "loan" | "transaction",
  search?: string,
): EntityRecord[] => {
  const normalizedSearch = search?.trim().toLowerCase() ?? "";

  return entities
    .filter((entity) => entity.entityType === entityType)
    .filter((entity) => {
      if (!normalizedSearch) {
        return true;
      }

      return entity.fullName.toLowerCase().includes(normalizedSearch);
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
};

export const cacheEntitiesResponse = async (
  spaceCode: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    const entities = normalizeEntityRecords(payload);
    await putLocalResponseSnapshot(entitiesKey(spaceCode), entities);
  } catch (error) {
    console.warn("[local-db] Failed to cache entities", error);
  }
};

export const loadCachedEntitiesResponse = async (
  spaceCode: string,
): Promise<EntityRecord[] | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const cached = await getLocalResponseSnapshot<EntityRecord[]>(
      entitiesKey(spaceCode),
    );
    if (!Array.isArray(cached)) {
      return undefined;
    }

    return cached;
  } catch (error) {
    console.warn("[local-db] Failed to load cached entities", error);
    return undefined;
  }
};

export const loadCachedEntityRecord = async (
  spaceCode: string,
  entityId: string,
): Promise<EntityRecord | undefined> => {
  const entities = await loadCachedEntitiesResponse(spaceCode);

  if (!entities?.length) {
    return undefined;
  }

  return entities.find((entity) => entity.id === entityId);
};

const namesMatch = (left: string | null | undefined, right: string): boolean =>
  (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();

const isIncomeOrExpense = (transaction: IndexTransaction): boolean =>
  transaction.type === CombinedTransactionTypeEnum.INCOME ||
  transaction.type === CombinedTransactionTypeEnum.EXPENSE;

const toEntityDetailLoan = (loan: Loan): EntityDetailLoan => ({
  id: loan.id,
  date: loan.date,
  description: loan.description,
  loanType: loan.loanType,
  status: loan.status,
  entityName: loan.entityName,
  accountName: loan.accountName,
  principalAmount: loan.principalAmount,
  outstandingBalance: loan.outstandingBalance,
  currency: loan.outstandingBalanceCurrency || loan.principalAmountCurrency,
});

const flattenCachedLoans = async (spaceCode: string): Promise<Loan[]> => {
  const cached = await loadCachedLoansInfiniteData(spaceCode);
  if (!cached?.pages?.length) {
    return [];
  }

  return cached.pages.flatMap((page) => page.loans ?? []);
};

const loadLocalTransactionsForEntity = async (
  spaceCode: string,
  entity: EntityRecord,
): Promise<IndexTransaction[]> => {
  const rows = await listSpaceTransactions(spaceCode);

  return rows
    .filter((transaction) => {
      if (transaction.entityId) {
        return transaction.entityId === entity.id;
      }

      return namesMatch(transaction.entityName, entity.fullName);
    })
    .filter(isIncomeOrExpense)
    .sort((left, right) => right.date.localeCompare(left.date));
};

const loadLocalLoansForEntity = async (
  spaceCode: string,
  entity: EntityRecord,
): Promise<EntityDetailLoan[]> => {
  const loans = await flattenCachedLoans(spaceCode);

  return loans
    .filter((loan) => namesMatch(loan.entityName, entity.fullName))
    .map(toEntityDetailLoan)
    .sort((left, right) => right.date.localeCompare(left.date));
};

const loadLocalLoanPaymentsForLoans = async (
  spaceCode: string,
  loans: EntityDetailLoan[],
): Promise<EntityDetailLoanPayment[]> => {
  const payments: EntityDetailLoanPayment[] = [];

  for (const loan of loans) {
    const cached = (await loadCachedLoanPayments(spaceCode, loan.id)) ?? [];

    for (const payment of cached) {
      payments.push({
        id: payment.id,
        date: payment.date,
        notes: payment.notes ?? null,
        currency: payment.currency,
        loanId: payment.loanId || loan.id,
        loanDescription: loan.description,
        accountName: payment.accountName || loan.accountName,
        principalPayment: payment.principalPayment,
        interestPayment: payment.interestPayment,
        totalPayment: payment.totalPayment,
      });
    }
  }

  return payments.sort((left, right) => right.date.localeCompare(left.date));
};

/**
 * Assemble entity detail from IndexedDB (entity list + related local rows).
 * Identifiers are not bootstrapped yet, so they stay empty until a network fetch.
 */
export const loadCachedEntityDetail = async (
  spaceCode: string,
  entityId: string,
): Promise<EntityDetail | undefined> => {
  const entity = await loadCachedEntityRecord(spaceCode, entityId);

  if (!entity) {
    return undefined;
  }

  const [transactions, loans] = await Promise.all([
    loadLocalTransactionsForEntity(spaceCode, entity),
    loadLocalLoansForEntity(spaceCode, entity),
  ]);
  const loanPayments = await loadLocalLoanPaymentsForLoans(spaceCode, loans);

  return {
    entity,
    transactions,
    loans,
    loanPayments,
    identifiers: [],
  };
};
