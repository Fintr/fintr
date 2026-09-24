import { getLocalDb } from "./db";
import type { LocalAccountRecord } from "./types";

const normalizeName = (value: string): string => value.trim().toLowerCase();

export type AccountNameResolver = {
  id: string;
  names: Set<string>;
};

const resolverFromRecord = (record: LocalAccountRecord): AccountNameResolver => {
  const names = new Set<string>();

  if (record.name.trim()) {
    names.add(normalizeName(record.name));
  }

  for (const previousName of record.previousNames ?? []) {
    if (previousName.trim()) {
      names.add(normalizeName(previousName));
    }
  }

  return {
    id: record.id,
    names,
  };
};

export const buildAccountNameResolvers = async (
  spaceId: string,
): Promise<AccountNameResolver[]> => {
  const records = await getLocalDb()
    .accounts
    .where("spaceId")
    .equals(spaceId)
    .toArray();

  return records.map(resolverFromRecord);
};

export const resolveAccountIdForName = (
  resolvers: AccountNameResolver[],
  name: string | null | undefined,
): string | null => {
  const normalized = normalizeName(name ?? "");
  if (!normalized) {
    return null;
  }

  for (const resolver of resolvers) {
    if (resolver.names.has(normalized)) {
      return resolver.id;
    }
  }

  return null;
};

const longestCommonPrefixLength = (left: string, right: string): number => {
  const max = Math.min(left.length, right.length);
  let index = 0;

  while (index < max && left[index] === right[index]) {
    index += 1;
  }

  return index;
};

/**
 * Last-resort matcher for legacy rows after a rename when previousNames
 * were not recorded yet (e.g. "BDO - Ella" -> "BDO - Ella2").
 */
export const fuzzyResolveAccountIdForName = (
  accounts: Array<{ id: string; name?: string }>,
  name: string | null | undefined,
): string | null => {
  const normalized = normalizeName(name ?? "");
  if (!normalized) {
    return null;
  }

  const candidates = accounts.filter((account) => {
    const accountNormalized = normalizeName(account.name ?? "");
    if (!accountNormalized) {
      return false;
    }

    const prefixLength = longestCommonPrefixLength(
      normalized,
      accountNormalized,
    );
    const minLength = Math.min(normalized.length, accountNormalized.length);

    return minLength >= 4 && prefixLength >= minLength * 0.75;
  });

  return candidates.length === 1 ? candidates[0].id : null;
};

export const appendAccountPreviousName = async (
  spaceId: string,
  accountId: string,
  previousName: string,
): Promise<void> => {
  const trimmed = previousName.trim();
  if (!spaceId || !accountId || !trimmed) {
    return;
  }

  const key = `${spaceId}:${accountId}`;
  const record = await getLocalDb().accounts.get(key);
  if (!record) {
    return;
  }

  const previousNames = [
    ...new Set([...(record.previousNames ?? []), trimmed]),
  ];

  await getLocalDb().accounts.put({
    ...record,
    previousNames,
  });
};
