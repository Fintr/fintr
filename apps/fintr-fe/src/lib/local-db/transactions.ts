import type { IndexTransaction } from "@/types/transactionTypes";

import { getLocalDb } from "./db";
import type { LocalTransactionRecord } from "./types";

export const transactionRecordKey = (
  spaceId: string,
  transactionId: string,
): string => `${spaceId}:${transactionId}`;

const transactionDateKey = (date: string): string => date.slice(0, 10);

const toLocalRecord = (
  spaceId: string,
  transaction: IndexTransaction,
  updatedAt: number,
): LocalTransactionRecord => ({
  key: transactionRecordKey(spaceId, transaction.id),
  spaceId,
  id: transaction.id,
  date: transactionDateKey(transaction.date),
  type: transaction.type,
  categoryId: transaction.categoryId ?? "",
  payload: transaction,
  updatedAt,
});

export const countSpaceTransactions = async (
  spaceId: string,
): Promise<number> =>
  getLocalDb().transactions.where("spaceId").equals(spaceId).count();

export const listSpaceTransactions = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  const records = await getLocalDb()
    .transactions
    .where("spaceId")
    .equals(spaceId)
    .toArray();

  return records.map((record) => record.payload);
};

export const listSpaceTransactionsInDateRange = async (
  spaceId: string,
  startDate: string,
  endDate: string,
): Promise<IndexTransaction[]> => {
  const records = await getLocalDb()
    .transactions
    .where("[spaceId+date]")
    .between(
      [spaceId, startDate],
      [spaceId, endDate],
      true,
      true,
    )
    .toArray();

  return records.map((record) => record.payload);
};

export const getSpaceTransaction = async (
  spaceId: string,
  transactionId: string,
): Promise<IndexTransaction | undefined> => {
  const record = await getLocalDb()
    .transactions
    .get(transactionRecordKey(spaceId, transactionId));

  return record?.payload;
};

export const putSpaceTransactions = async (
  spaceId: string,
  transactions: IndexTransaction[],
): Promise<void> => {
  if (!spaceId || transactions.length === 0) {
    return;
  }

  const updatedAt = Date.now();
  const records = transactions.map((transaction) =>
    toLocalRecord(spaceId, transaction, updatedAt),
  );

  await getLocalDb().transactions.bulkPut(records);
};

export const deleteSpaceTransactions = async (
  spaceId: string,
  transactionIds: string[],
): Promise<void> => {
  if (!spaceId || transactionIds.length === 0) {
    return;
  }

  const keys = transactionIds.map((id) => transactionRecordKey(spaceId, id));
  await getLocalDb().transactions.bulkDelete(keys);
};

export const clearSpaceTransactions = async (spaceId: string): Promise<void> => {
  const db = getLocalDb();
  await db.transaction("rw", db.transactions, db.meta, async () => {
    await db.transactions.where("spaceId").equals(spaceId).delete();
    await db.meta.delete(`transactionsIndexComplete:${spaceId}`);
  });
};

export const isSpaceTransactionIndexComplete = async (
  spaceId: string,
): Promise<boolean> => {
  const row = await getLocalDb().meta.get(`transactionsIndexComplete:${spaceId}`);
  return row?.value === true;
};

export const markSpaceTransactionIndexComplete = async (
  spaceId: string,
): Promise<void> => {
  await getLocalDb().meta.put({
    key: `transactionsIndexComplete:${spaceId}`,
    value: true,
  });
};
