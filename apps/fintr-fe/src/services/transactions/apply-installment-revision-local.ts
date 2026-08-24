import type { QueryClient } from "@tanstack/react-query";

import { UpdateScopeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import type { UpdateTransactionType } from "@/types/transactionTypes";
import { computeInstallmentPlanRevision, installmentOccurrenceDates } from "@fintr/domain";
import { getLocalIsoDateKey } from "@/utils/dateUtils";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";
import {
  buildLedgerOccurrenceCentsByDate,
  indexRowLedgerAmountCents,
  ledgerPerPaymentToBookedAmount,
  resolveInstallmentRevisionFx,
  resolvePlanTotalLedgerCents,
} from "@/utils/installmentRevisionLedger";

import { optimisticIndexMoneyFromCreate } from "./create-local-first";
import {
  loadAllTransactionsFromLocalIndex,
  removeLocalIndexTransactionsByIds,
  upsertLocalIndexTransaction,
} from "./local-cache";
import type { UpdateTransactionType as MutationUpdateType } from "./mutation";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "./upsert-into-query-caches";
import { preferOccurrenceRowForDate } from "@/utils/recurringSchedule";
import { removeIndexTransactionsFromQueryCaches } from "./remove-from-query-caches";

const resolveSeriesRootId = (row: IndexTransaction): string =>
  row.rootParentId?.trim()
  || row.parentId?.trim()
  || row.id;

const collectInstallmentSeriesRows = ({
  allRows,
  target,
  occurrenceDates,
}: {
  allRows: IndexTransaction[];
  target: IndexTransaction;
  occurrenceDates: Set<string>;
}): IndexTransaction[] => {
  const rootId = resolveSeriesRootId(target);
  const childrenByParentId = new Map<string, IndexTransaction[]>();

  allRows.forEach((row) => {
    const parentId = row.parentId?.trim();
    if (!parentId) {
      return;
    }

    const children = childrenByParentId.get(parentId) ?? [];
    children.push(row);
    childrenByParentId.set(parentId, children);
  });

  const includedIds = new Set<string>();
  const queue: string[] = [];

  const consider = (row: IndexTransaction) => {
    if (includedIds.has(row.id)) {
      return;
    }

    includedIds.add(row.id);
    queue.push(row.id);
  };

  allRows.forEach((row) => {
    const rowRoot = resolveSeriesRootId(row);
    const dateKey = getLocalIsoDateKey(row.date);
    if (
      rowRoot === rootId
      || row.id === rootId
      || row.parentId === rootId
      || row.parentId === target.id
      || rowRoot === target.id
    ) {
      consider(row);
      return;
    }

    if (
      occurrenceDates.has(dateKey)
      && row.description === target.description
      && (
        row.scheduleType === target.scheduleType
        || row.scheduleType === "installment"
      )
    ) {
      consider(row);
    }
  });

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId) {
      continue;
    }

    (childrenByParentId.get(parentId) ?? []).forEach((child) => {
      consider(child);
    });
  }

  return allRows.filter((row) => includedIds.has(row.id));
};

const leftoverRowsOnRemainingDates = ({
  allRows,
  seriesRows,
  target,
  remainingDateKeys,
  spaceCurrency,
}: {
  allRows: IndexTransaction[];
  seriesRows: IndexTransaction[];
  target: IndexTransaction;
  remainingDateKeys: Set<string>;
  spaceCurrency: string;
}): IndexTransaction[] => {
  const originalById = new Map(allRows.map((row) => [row.id, row]));
  const candidates = allRows.filter((row) => {
    const dateKey = getLocalIsoDateKey(row.date);
    if (!remainingDateKeys.has(dateKey)) {
      return false;
    }

    if (row.description !== target.description) {
      return false;
    }

    return (
      row.scheduleType === target.scheduleType
      || row.scheduleType === "installment"
      || seriesRows.some((seriesRow) => seriesRow.id === row.id)
    );
  });
  const grouped = new Map<string, IndexTransaction[]>();

  candidates.forEach((row) => {
    const dateKey = getLocalIsoDateKey(row.date);
    const list = grouped.get(dateKey) ?? [];
    list.push(originalById.get(row.id) ?? row);
    grouped.set(dateKey, list);
  });

  const drop: IndexTransaction[] = [];

  grouped.forEach((dateRows) => {
    if (dateRows.length < 2) {
      return;
    }

    const keep =
      dateRows.find((row) => row.id === target.id)
      ?? preferOccurrenceRowForDate(dateRows, spaceCurrency);
    dateRows.forEach((row) => {
      if (row.id !== keep.id) {
        drop.push(row);
      }
    });
  });

  return drop;
};

const resolveSeriesParentDate = (
  rows: IndexTransaction[],
  rootId: string,
): string | null => {
  const root =
    rows.find((row) => row.id === rootId)
    ?? rows[0];

  if (!root) {
    return null;
  }

  return getLocalIsoDateKey(
    (root as IndexTransaction & { seriesParentDate?: string | null })
      .seriesParentDate
    ?? root.date,
  );
};

export const computeLocalInstallmentPlanRevision = ({
  target,
  seriesRows,
  data,
  spaceCurrency,
}: {
  target: IndexTransaction;
  seriesRows: IndexTransaction[];
  data: UpdateTransactionType & {
    original_currency?: string;
    exchange_rate?: number;
    installmentRevisionAnchor?: string;
  };
  spaceCurrency: string;
}) => {
  const rootId = resolveSeriesRootId(target);
  const parentDate = resolveSeriesParentDate(seriesRows, rootId);
  const periodMonths =
    data.installmentPeriod
    ?? target.installmentPeriod
    ?? 0;

  if (!parentDate || periodMonths <= 0) {
    return null;
  }

  const revisionFx = resolveInstallmentRevisionFx({
    originalCurrency: data.original_currency,
    exchangeRate: data.exchange_rate,
    spaceCurrency,
    storedOriginalCurrency: target.currencyConversion?.originalCurrency,
    storedConvertedCurrency: target.currencyConversion?.convertedCurrency,
    storedExchangeRate: target.currencyConversion?.exchangeRate,
  });
  const planTotalLedgerCents = resolvePlanTotalLedgerCents({
    planTotal: Number(data.installmentTotal),
    originalCurrency: revisionFx.originalCurrency,
    exchangeRate: revisionFx.exchangeRate,
    spaceCurrency: revisionFx.ledgerCurrency,
  });

  if (planTotalLedgerCents <= 0) {
    return null;
  }

  const occurrenceCentsByDate = buildLedgerOccurrenceCentsByDate(seriesRows);
  const frozenDefaults = seriesRows
    .filter((row) => getLocalIsoDateKey(row.date) < getLocalIsoDateKey(target.date))
    .map((row) => indexRowLedgerAmountCents(row))
    .filter((cents) => cents > 0);
  const priorPerPaymentCents =
    (
      frozenDefaults.length > 0
        ? Math.min(...frozenDefaults)
        : indexRowLedgerAmountCents(target)
    )
    || 0;
  const effectiveDate =
    data.updateScope === UpdateScopeEnum.ALL_IN_SERIES
      ? parentDate
      : getLocalIsoDateKey(target.date);
  const anchor =
    data.installmentRevisionAnchor === "monthly"
      ? "monthly"
      : data.installmentRevisionAnchor === "explicit"
        ? "explicit"
        : "total";

  return computeInstallmentPlanRevision({
    installmentTotalCents: planTotalLedgerCents,
    currency: revisionFx.ledgerCurrency,
    newPeriod: periodMonths,
    parentDate,
    effectiveDate,
    anchor,
    paidSoFarCents: 0,
    newMonthlyCents:
      anchor === "monthly"
        ? resolvePlanTotalLedgerCents({
            planTotal: Math.abs(Number(data.amount) || 0),
            originalCurrency: revisionFx.originalCurrency,
            exchangeRate: revisionFx.exchangeRate,
            spaceCurrency: revisionFx.ledgerCurrency,
          })
        : undefined,
    priorPerPaymentCents,
    occurrenceCentsByDate,
  });
};

export const applyInstallmentPlanRevisionLocal = async ({
  spaceId,
  target,
  data,
  spaceCurrency,
  queryClient,
}: {
  spaceId: string;
  target: IndexTransactionWithCategoryIds;
  data: MutationUpdateType & {
    original_currency?: string;
    exchange_rate?: number;
    exchange_rate_source?: "auto" | "manual" | "recent";
    installmentRevisionAnchor?: string;
  };
  spaceCurrency: string;
  queryClient?: QueryClient;
}): Promise<IndexTransactionWithCategoryIds[]> => {
  const allRows = await loadAllTransactionsFromLocalIndex(spaceId);
  const rootId = resolveSeriesRootId(target);
  const parentDate = resolveSeriesParentDate(
    allRows.filter((row) => {
      const rowRoot = resolveSeriesRootId(row);
      return rowRoot === rootId || row.id === rootId || row.parentId === rootId;
    }),
    rootId,
  ) ?? getLocalIsoDateKey(
    (target as IndexTransaction & { seriesParentDate?: string | null })
      .seriesParentDate
    ?? target.date,
  );
  const periodMonths =
    data.installmentPeriod
    ?? target.installmentPeriod
    ?? 0;
  const occurrenceDates = new Set(
    periodMonths > 0 && parentDate
      ? installmentOccurrenceDates({
          parentDate,
          period: periodMonths,
        })
      : [],
  );
  const seriesRows = collectInstallmentSeriesRows({
    allRows,
    target,
    occurrenceDates,
  });

  if (seriesRows.length === 0) {
    return [];
  }

  const revision = computeLocalInstallmentPlanRevision({
    target,
    seriesRows,
    data,
    spaceCurrency,
  });

  if (!revision) {
    return [];
  }

  const effectiveDate =
    data.updateScope === UpdateScopeEnum.ALL_IN_SERIES
      ? resolveSeriesParentDate(seriesRows, rootId)
      : getLocalIsoDateKey(target.date);

  if (!effectiveDate) {
    return [];
  }

  const revisionFx = resolveInstallmentRevisionFx({
    originalCurrency: data.original_currency,
    exchangeRate: data.exchange_rate,
    spaceCurrency,
    storedOriginalCurrency: target.currencyConversion?.originalCurrency,
    storedConvertedCurrency: target.currencyConversion?.convertedCurrency,
    storedExchangeRate: target.currencyConversion?.exchangeRate,
  });
  const remainingDateKeys = new Set(
    [...occurrenceDates].filter((date) => date >= effectiveDate),
  );
  seriesRows.forEach((row) => {
    const dateKey = getLocalIsoDateKey(row.date);
    if (dateKey >= effectiveDate) {
      remainingDateKeys.add(dateKey);
    }
  });
  const leftoverIds = new Set(
    leftoverRowsOnRemainingDates({
      allRows,
      seriesRows,
      target,
      remainingDateKeys,
      spaceCurrency: revisionFx.ledgerCurrency,
    }).map((row) => row.id),
  );
  const installmentTotal = revision.installmentTotalCents / 100;
  const exchangeRate = revisionFx.exchangeRate;
  const entryCurrency = revisionFx.originalCurrency;
  const ledgerCurrency = revisionFx.ledgerCurrency;
  const bookedPerPayment = ledgerPerPaymentToBookedAmount({
    perPaymentLedger: revision.perPayment,
    exchangeRate,
    originalCurrency: entryCurrency,
    ledgerCurrency,
  });
  const moneyTemplate = optimisticIndexMoneyFromCreate({
    occurrenceAmount: bookedPerPayment,
    data: {
      ...data,
      transactionType:
        target.type === CombinedTransactionTypeEnum.INCOME
          ? "income"
          : "expense",
      categoryName: target.categoryName ?? "",
      accountName: target.fromAccountName || target.toAccountName || "",
      date: target.date,
      scheduleType: target.scheduleType,
      original_currency: entryCurrency,
      exchange_rate: exchangeRate,
      exchange_rate_source: data.exchange_rate_source,
    },
    entryCurrency,
    spaceCurrency: ledgerCurrency,
  });

  const updatedRows = seriesRows
    .filter((row) => !leftoverIds.has(row.id))
    .map((row) => {
    const appliesRevision =
      data.updateScope === UpdateScopeEnum.ALL_IN_SERIES
      || getLocalIsoDateKey(row.date) >= effectiveDate;

    if (!appliesRevision) {
      return {
        ...row,
        installmentTotal,
        installmentPeriod:
          data.installmentPeriod
          ?? row.installmentPeriod
          ?? target.installmentPeriod,
      } as IndexTransactionWithCategoryIds;
    }

    return {
      ...row,
      ...moneyTemplate,
      installmentTotal,
      installmentPeriod:
        data.installmentPeriod
        ?? row.installmentPeriod
        ?? target.installmentPeriod,
      currencyConversion: moneyTemplate.bookedAmountCurrency
        ? {
            originalAmount: moneyTemplate.bookedAmount ?? bookedPerPayment,
            originalCurrency: moneyTemplate.bookedAmountCurrency,
            convertedAmount: Math.abs(Number(moneyTemplate.amount) || 0),
            convertedCurrency:
              moneyTemplate.amountCurrency
              ?? spaceCurrency,
            exchangeRate,
            source: data.exchange_rate_source ?? "manual",
          }
        : row.currencyConversion,
    } as IndexTransactionWithCategoryIds;
  });

  const existingDateKeys = new Set(
    updatedRows.map((row) => getLocalIsoDateKey(row.date)),
  );
  const missingDates = [...occurrenceDates].filter(
    (date) => !existingDateKeys.has(date),
  );
  const templateRow = updatedRows[0];
  const createdRows: IndexTransactionWithCategoryIds[] =
    templateRow && missingDates.length > 0
      ? missingDates.map((date) => ({
          ...templateRow,
          ...moneyTemplate,
          id: `local:${rootId}:${date}`,
          date,
          parentId: date === parentDate ? null : rootId,
          rootParentId: rootId,
          inSeries: true,
          calculated: isTransactionCalculatedForDate(date),
          installmentTotal,
          installmentPeriod:
            data.installmentPeriod
            ?? templateRow.installmentPeriod
            ?? target.installmentPeriod,
          currencyConversion: moneyTemplate.bookedAmountCurrency
            ? {
                originalAmount: moneyTemplate.bookedAmount ?? bookedPerPayment,
                originalCurrency: moneyTemplate.bookedAmountCurrency,
                convertedAmount: Math.abs(Number(moneyTemplate.amount) || 0),
                convertedCurrency:
                  moneyTemplate.amountCurrency
                  ?? spaceCurrency,
                exchangeRate,
                source: data.exchange_rate_source ?? "manual",
              }
            : templateRow.currencyConversion,
        } as IndexTransactionWithCategoryIds))
      : [];
  const persistedRows = [...updatedRows, ...createdRows];

  for (const row of persistedRows) {
    await upsertLocalIndexTransaction(spaceId, row);
  }

  if (leftoverIds.size > 0) {
    await removeLocalIndexTransactionsByIds(spaceId, [...leftoverIds]);
    if (queryClient) {
      removeIndexTransactionsFromQueryCaches(queryClient, {
        spaceId,
        removedIds: [...leftoverIds],
      });
    }
  }

  if (queryClient && persistedRows.length > 0) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: persistedRows,
    });
  }

  return persistedRows;
};
