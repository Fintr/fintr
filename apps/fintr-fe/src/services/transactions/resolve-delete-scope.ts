import type { QueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";

import { DeleteScopeEnum, ScheduleTypeEnum } from "@/constants/transactionConstants";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  buildTransferFeeDescription,
  TRANSFER_FEE_CATEGORY_NAME,
} from "./transfers/fee-description";

const transactionDateKey = (date: string): string => date.slice(0, 10);

/**
 * Combined view uses NULL category_name for transfers; optimistic local rows may
 * still say "Transfer". Treat those as the same for series matching.
 */
const categoryFingerprint = (row: IndexTransaction): string => {
  const raw = (row.categoryName ?? "").trim().toLowerCase();
  if (row.type === CombinedTransactionTypeEnum.TRANSFER) {
    if (raw === "" || raw === "transfer") {
      return "transfer";
    }
  }
  return raw;
};

export const seriesFingerprintKey = (row: IndexTransaction): string =>
  [
    row.type,
    (row.description ?? "").trim(),
    categoryFingerprint(row),
    row.subcategoryName ?? "",
    row.fromAccountName ?? "",
    row.toAccountName ?? "",
    String(Math.abs(Number(row.amount) || 0)),
    row.amountCurrency ?? "",
  ].join("\0");

export const sameSeriesFingerprint = (
  a: IndexTransaction,
  b: IndexTransaction,
): boolean => seriesFingerprintKey(a) === seriesFingerprintKey(b);

export const isRecurringScheduleType = (
  scheduleType?: string | null,
): boolean =>
  scheduleType === ScheduleTypeEnum.REPEAT
  || scheduleType === ScheduleTypeEnum.INSTALLMENT
  || scheduleType === "repeat"
  || scheduleType === "installment";

/**
 * Whether delete/update scope modals should offer series-wide options.
 */
export const transactionAllowsSeriesDeleteScope = (
  row: Pick<IndexTransaction, "inSeries" | "parentId" | "scheduleType"> | null | undefined,
): boolean => {
  if (!row) {
    return false;
  }

  if (row.inSeries) {
    return true;
  }

  if (row.parentId) {
    return true;
  }

  return isRecurringScheduleType(row.scheduleType);
};

const hasRecurringFingerprintCluster = (
  row: IndexTransaction,
  rows: IndexTransaction[],
  minDistinctDates = 3,
): boolean => {
  const siblings = rows.filter(
    (other) => other.id !== row.id && sameSeriesFingerprint(row, other),
  );

  if (siblings.length === 0) {
    return false;
  }

  if (siblings.some((other) => transactionAllowsSeriesDeleteScope(other))) {
    return true;
  }

  const distinctDates = new Set(
    [row, ...siblings].map((entry) => transactionDateKey(entry.date)),
  );

  return distinctDates.size >= minDistinctDates;
};

const resolveTransactionInSeriesWithMinDates = (
  row: IndexTransaction,
  rows: IndexTransaction[],
  minDistinctDates: number,
): boolean => {
  if (transactionAllowsSeriesDeleteScope(row)) {
    return true;
  }

  if (hasRecurringFingerprintCluster(row, rows, minDistinctDates)) {
    return true;
  }

  return rows.some(
    (other) =>
      other.id !== row.id
      && sameSeriesFingerprint(row, other)
      && transactionAllowsSeriesDeleteScope(other),
  );
};

/**
 * True when the row is part of a repeat/installment series. Siblings may have
 * a stale `inSeries: false` (e.g. series parent); match by fingerprint or parentId.
 */
export const resolveTransactionInSeries = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): boolean => resolveTransactionInSeriesWithMinDates(row, rows, 3);

const hasSpacedFingerprintPairForDisplay = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): boolean => {
  const siblings = rows.filter(
    (other) => other.id !== row.id && sameSeriesFingerprint(row, other),
  );

  if (siblings.length === 0) {
    return false;
  }

  if (siblings.some((other) => transactionAllowsSeriesDeleteScope(other))) {
    return true;
  }

  const distinctDateKeys = [...new Set(
    [row, ...siblings].map((entry) => transactionDateKey(entry.date)),
  )].sort();

  if (distinctDateKeys.length < 2) {
    return false;
  }

  const earliest = parseISO(distinctDateKeys[0]!);
  const latest = parseISO(distinctDateKeys[distinctDateKeys.length - 1]!);
  const spanDays = differenceInCalendarDays(latest, earliest);

  // Weekly+ spacing catches legacy pairs; daily series need 3+ dates (handled above).
  return spanDays >= 6;
};

/** Display-only: spaced fingerprint pairs (e.g. legacy weekly) without series metadata. */
export const resolveTransactionInSeriesForDisplay = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): boolean =>
  resolveTransactionInSeriesWithMinDates(row, rows, 3)
  || hasSpacedFingerprintPairForDisplay(row, rows);

export const withResolvedInSeries = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): IndexTransaction => {
  if (!resolveTransactionInSeries(row, rows)) {
    return row;
  }

  return row.inSeries ? row : { ...row, inSeries: true };
};

const enrichRowScheduleFromSeriesContext = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): IndexTransaction => {
  if (!resolveTransactionInSeriesForDisplay(row, rows)) {
    return row;
  }

  let next: IndexTransaction = { ...row };

  const parent = next.parentId
    ? rows.find((entry) => entry.id === next.parentId)
    : undefined;
  if (parent) {
    next = {
      ...next,
      scheduleType: next.scheduleType ?? parent.scheduleType,
      repeatInterval: next.repeatInterval ?? parent.repeatInterval,
      rootParentId: next.rootParentId ?? parent.rootParentId ?? parent.id,
    };
  }

  const childWithSchedule = rows.find(
    (entry) =>
      entry.parentId === next.id
      && (
        entry.repeatInterval
        || isRecurringScheduleType(entry.scheduleType)
      ),
  );
  if (childWithSchedule) {
    next = {
      ...next,
      scheduleType: next.scheduleType ?? childWithSchedule.scheduleType,
      repeatInterval: next.repeatInterval ?? childWithSchedule.repeatInterval,
    };
  }

  const siblingDonor = rows.find(
    (other) =>
      other.id !== next.id
      && sameSeriesFingerprint(next, other)
      && (
        other.repeatInterval
        || isRecurringScheduleType(other.scheduleType)
      ),
  );
  if (siblingDonor) {
    next = {
      ...next,
      scheduleType: next.scheduleType ?? siblingDonor.scheduleType,
      repeatInterval: next.repeatInterval ?? siblingDonor.repeatInterval,
      rootParentId:
        next.rootParentId
        ?? siblingDonor.rootParentId
        ?? siblingDonor.parentId
        ?? siblingDonor.id,
    };
  }

  if (!isRecurringScheduleType(next.scheduleType) && !next.repeatInterval) {
    next = {
      ...next,
      scheduleType: ScheduleTypeEnum.REPEAT,
    };
  }

  if (!next.rootParentId) {
    if (next.parentId) {
      next = { ...next, rootParentId: next.parentId };
    } else if (isRecurringScheduleType(next.scheduleType)) {
      next = { ...next, rootParentId: next.id };
    }
  }

  return next;
};

/**
 * Resolve stale series flags and schedule metadata for ledger display.
 * Legacy rows may lack inSeries / schedule fields even when they belong to a series.
 */
export const enrichLedgerTransactionsForDisplay = (
  rows: IndexTransaction[],
): IndexTransaction[] => {
  const withSeriesFlag = rows.map((row) => {
    if (!resolveTransactionInSeriesForDisplay(row, rows)) {
      return row;
    }

    return row.inSeries ? row : { ...row, inSeries: true };
  });

  return withSeriesFlag.map((row) =>
    enrichRowScheduleFromSeriesContext(row, withSeriesFlag),
  );
};

export const flattenTransactionsFromPages = (
  pages: Array<{ transactions?: IndexTransaction[] }> | undefined,
): IndexTransaction[] => {
  if (!pages?.length) {
    return [];
  }

  const byId = new Map<string, IndexTransaction>();
  for (const page of pages) {
    for (const row of page.transactions ?? []) {
      if (row?.id) {
        byId.set(row.id, row);
      }
    }
  }

  return Array.from(byId.values());
};

const inDeleteDateScope = (
  rowDate: string,
  targetDate: string,
  deleteScope: DeleteScopeEnum,
): boolean => {
  const rowKey = transactionDateKey(rowDate);
  const targetKey = transactionDateKey(targetDate);
  if (deleteScope === DeleteScopeEnum.THIS_ONLY) {
    return rowKey === targetKey;
  }
  if (deleteScope === DeleteScopeEnum.THIS_AND_FUTURE) {
    return rowKey >= targetKey;
  }
  return true;
};

/**
 * Collect index rows currently loaded in React Query transaction lists.
 */
export const collectIndexTransactionsFromQueryCaches = (
  queryClient: QueryClient,
  spaceId: string,
): IndexTransaction[] => {
  if (!spaceId) return [];

  const byId = new Map<string, IndexTransaction>();
  const entries = queryClient.getQueriesData<unknown>({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "transactions") return false;
      return key[1] === spaceId || key[2] === spaceId;
    },
  });

  for (const [, old] of entries) {
    if (!old || typeof old !== "object") continue;
    const pages = (old as { pages?: unknown }).pages;
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      if (!page || typeof page !== "object") continue;
      const rows = (page as { transactions?: IndexTransaction[] }).transactions;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row?.id) byId.set(row.id, row);
      }
    }
  }

  return Array.from(byId.values());
};

/**
 * Resolve series members for a delete scope from an in-memory row set.
 * Does not require every sibling to have `inSeries` (stale local flags), but
 * never expands when neither the target nor the candidate is marked in-series —
 * otherwise identical one-time expenses (same amount/category/account) get
 * wiped together when a stale `all_in_series` scope slips through.
 */
export const resolveSeriesRowsForDeleteScope = (params: {
  rows: IndexTransaction[];
  target: IndexTransaction;
  deleteScope: DeleteScopeEnum;
}): IndexTransaction[] => {
  const { rows, target, deleteScope } = params;
  if (!target?.id) return [];

  if (deleteScope === DeleteScopeEnum.THIS_ONLY) {
    return [target];
  }

  const byId = new Map<string, IndexTransaction>();
  byId.set(target.id, target);
  const targetLooksLikeSeries = resolveTransactionInSeries(target, rows);

  for (const row of rows) {
    if (!row?.id || row.id === target.id) continue;
    if (!sameSeriesFingerprint(row, target)) continue;
    if (!inDeleteDateScope(row.date, target.date, deleteScope)) continue;
    // One-time clones share fingerprints often; require series signal on at
    // least one side before treating them as the same recurring series.
    if (!targetLooksLikeSeries && !resolveTransactionInSeries(row, rows)) {
      continue;
    }
    byId.set(row.id, row);
  }

  return Array.from(byId.values());
};

export const isTransferFeeExpenseRow = (row: IndexTransaction): boolean =>
  row.type === CombinedTransactionTypeEnum.EXPENSE &&
  row.categoryName.trim().toLowerCase() ===
    TRANSFER_FEE_CATEGORY_NAME.toLowerCase();

/**
 * Find transfer-fee expenses linked to the transfer fingerprint.
 */
export const resolveLinkedTransferFeeRows = (params: {
  rows: IndexTransaction[];
  transfers: IndexTransaction[];
  deleteScope: DeleteScopeEnum;
  targetDate: string;
}): IndexTransaction[] => {
  const { rows, transfers, deleteScope, targetDate } = params;
  if (transfers.length === 0) return [];

  const feeById = new Map<string, IndexTransaction>();
  const transferAmount = Math.abs(Number(transfers[0]?.amount) || 0);
  const transferDescription = (transfers[0]?.description ?? "").trim();
  const fromAccount = transfers[0]?.fromAccountName ?? "";
  const expectedDescription = buildTransferFeeDescription({
    description: transferDescription,
    transferAmount,
  });

  for (const row of rows) {
    if (!row?.id || feeById.has(row.id)) continue;
    if (!isTransferFeeExpenseRow(row)) continue;
    if ((row.fromAccountName ?? "") !== fromAccount) continue;
    if (!inDeleteDateScope(row.date, targetDate, deleteScope)) continue;

    const isLocalSibling = transfers.some(
      (transfer) =>
        transfer.id.startsWith("local:") && row.id === `${transfer.id}:fee`,
    );
    if (isLocalSibling) {
      feeById.set(row.id, row);
      continue;
    }

    const description = row.description ?? "";
    const matchesExpected = description === expectedDescription;
    const matchesLabeledNote =
      Boolean(transferDescription) &&
      description.includes(`Transfer fee for: ${transferDescription}`) &&
      description.includes(`amount: ${transferAmount}`);
    const matchesNoNote =
      !transferDescription &&
      description.startsWith("Transfer fee") &&
      description.includes(`amount: ${transferAmount}`);

    if (matchesExpected || matchesLabeledNote || matchesNoNote) {
      feeById.set(row.id, row);
    }
  }

  return Array.from(feeById.values());
};
