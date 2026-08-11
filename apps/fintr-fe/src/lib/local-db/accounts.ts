import type { Account } from "@/types/accountTypes";

import { getLocalDb } from "./db";
import type { LocalAccountRecord } from "./types";

export const accountCacheKey = (spaceId: string, accountId: string): string =>
  `${spaceId}:${accountId}`;

const toLocalRecord = (
  spaceId: string,
  account: Account,
  cachedAt: number
): LocalAccountRecord => ({
  key: accountCacheKey(spaceId, account.id),
  spaceId,
  id: account.id,
  name: account.name,
  balance: account.balance,
  balanceCurrency: account.balanceCurrency,
  accountCategory: account.accountCategory,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  cachedAt,
});

const toAccount = (record: LocalAccountRecord): Account => ({
  id: record.id,
  name: record.name,
  balance: record.balance,
  balanceCurrency: record.balanceCurrency,
  accountCategory: record.accountCategory,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const replaceSpaceAccounts = async (
  spaceId: string,
  accounts: Account[]
): Promise<void> => {
  const db = getLocalDb();
  const cachedAt = Date.now();
  const records = accounts.map((account) =>
    toLocalRecord(spaceId, account, cachedAt)
  );

  await db.transaction("rw", db.accounts, db.meta, async () => {
    await db.accounts.where("spaceId").equals(spaceId).delete();
    if (records.length > 0) {
      await db.accounts.bulkPut(records);
    }
    await db.meta.put({
      key: `accountsSyncedAt:${spaceId}`,
      value: cachedAt,
    });
  });
};

export const listSpaceAccounts = async (
  spaceId: string
): Promise<Account[]> => {
  const records = await getLocalDb()
    .accounts.where("spaceId")
    .equals(spaceId)
    .toArray();

  return records
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toAccount);
};

export const getAccountsSyncedAt = async (
  spaceId: string
): Promise<number | null> => {
  const row = await getLocalDb().meta.get(`accountsSyncedAt:${spaceId}`);
  if (typeof row?.value === "number") {
    return row.value;
  }
  return null;
};

export const clearSpaceAccounts = async (spaceId: string): Promise<void> => {
  const db = getLocalDb();
  await db.transaction("rw", db.accounts, db.meta, async () => {
    await db.accounts.where("spaceId").equals(spaceId).delete();
    await db.meta.delete(`accountsSyncedAt:${spaceId}`);
  });
};
