import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { QueryClient } from "@tanstack/react-query";
import { listSpaceTransactions } from "@/lib/local-db/transactions";
import { ENTITY_DETAIL_KEY } from "@/hooks/async/useEntityDetail";
import {
  loadCachedLoanPayments,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";
import {
  normalizeEntityIdentifiers,
  type EntityDetail,
  type EntityDetailLoan,
  type EntityDetailLoanPayment,
  type EntityIdentifier,
  type EntityRecord,
} from "@/services/entities/mutation";

const entitiesKey = (spaceCode: string): string => `entities:${spaceCode}`;

export const normalizeEntityRecord = (
  entity: Record<string, unknown>,
): EntityRecord => {
  const identifiers = normalizeEntityIdentifiers(entity.identifiers);
  const record: EntityRecord = {
    id: String(entity.id ?? ""),
    fullName: String(entity.fullName ?? entity.full_name ?? ""),
    entityType: (entity.entityType ?? entity.entity_type ?? "loan") as
      | "loan"
      | "transaction",
    photoUrl:
      (entity.photoUrl ?? entity.photo_url ?? null) as string | null | undefined,
  };

  if (identifiers) {
    record.identifiers = identifiers;
  }

  return record;
};

const mergePreservedIdentifiers = (
  incoming: EntityRecord[],
  previous: EntityRecord[] | undefined,
): EntityRecord[] => {
  const previousById = new Map(
    (previous ?? []).map((entity) => [entity.id, entity]),
  );

  return incoming.map((entity) => {
    if (entity.identifiers !== undefined) {
      return entity;
    }

    const priorIdentifiers = previousById.get(entity.id)?.identifiers;
    if (!priorIdentifiers) {
      return entity;
    }

    return {
      ...entity,
      identifiers: priorIdentifiers,
    };
  });
};

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
    const previous = await loadCachedEntitiesResponse(spaceCode);
    const entities = mergePreservedIdentifiers(
      normalizeEntityRecords(payload),
      previous,
    );
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

export const loadEntities = async (
  spaceCode: string,
): Promise<EntityRecord[]> =>
  (await loadCachedEntitiesResponse(spaceCode)) ?? [];

export const upsertEntityInList = (
  entities: EntityRecord[],
  entity: EntityRecord,
): EntityRecord[] => {
  const index = entities.findIndex((row) => row.id === entity.id);

  if (index >= 0) {
    const next = [...entities];
    next[index] = entity;
    return next;
  }

  return [...entities, entity];
};

export const removeEntityFromList = (
  entities: EntityRecord[],
  entityId: string,
): EntityRecord[] => entities.filter((entity) => entity.id !== entityId);

export const replaceEntityIdInList = (
  entities: EntityRecord[],
  localId: string,
  serverId: string,
): EntityRecord[] =>
  entities.map((entity) =>
    entity.id === localId ? { ...entity, id: serverId } : entity,
  );

export const applyEntitiesToCaches = async (params: {
  spaceCode: string;
  entities: EntityRecord[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, entities, queryClient } = params;

  await cacheEntitiesResponse(spaceCode, entities);

  if (!queryClient) {
    return;
  }

  for (const entityType of ["loan", "transaction"] as const) {
    queryClient.setQueryData(
      ["entities", spaceCode, entityType, ""],
      filterCachedEntities(entities, entityType),
    );
  }

  queryClient.setQueryData(["entities", "local", spaceCode], entities);
};

export const patchEntityDetailInCaches = (params: {
  spaceCode: string;
  entity: EntityRecord;
  queryClient?: QueryClient;
}): void => {
  const { spaceCode, entity, queryClient } = params;

  if (!queryClient || !spaceCode || !entity.id) {
    return;
  }

  const patchDetail = (detail: EntityDetail | null | undefined) => {
    if (!detail) {
      return detail;
    }

    return {
      ...detail,
      entity,
    };
  };

  queryClient.setQueryData(
    [ENTITY_DETAIL_KEY, "local", spaceCode, entity.id],
    patchDetail,
  );
  queryClient.setQueryData(
    [ENTITY_DETAIL_KEY, spaceCode, entity.id],
    patchDetail,
  );
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

export const cacheEntityIdentifiers = async (params: {
  spaceCode: string;
  entityId: string;
  identifiers: EntityIdentifier[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, entityId, identifiers, queryClient } = params;

  if (!spaceCode || !entityId) {
    return;
  }

  const entities = (await loadCachedEntitiesResponse(spaceCode)) ?? [];
  const nextEntities = entities.map((entity) =>
    entity.id === entityId
      ? {
          ...entity,
          identifiers,
        }
      : entity,
  );

  if (nextEntities.some((entity) => entity.id === entityId)) {
    await cacheEntitiesResponse(spaceCode, nextEntities);
  }

  if (!queryClient) {
    return;
  }

  const patchDetail = (detail: EntityDetail | null | undefined) => {
    if (!detail || detail.entity.id !== entityId) {
      return detail;
    }

    return {
      ...detail,
      identifiers,
      entity: {
        ...detail.entity,
        identifiers,
      },
    };
  };

  queryClient.setQueryData(
    [ENTITY_DETAIL_KEY, "local", spaceCode, entityId],
    patchDetail,
  );
  queryClient.setQueryData(
    [ENTITY_DETAIL_KEY, spaceCode, entityId],
    patchDetail,
  );
};

/**
 * Assemble entity detail from IndexedDB (entity list + related local rows).
 * Merchant identifiers live on the cached entity so receipt aliases survive refresh.
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
    identifiers: entity.identifiers ?? [],
  };
};
