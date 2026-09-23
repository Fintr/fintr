import {
  listSpaceTransactions,
  putSpaceTransactions,
} from "@/lib/local-db";
import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { QueryClient } from "@tanstack/react-query";
import type { IndexTransaction } from "@/types/transactionTypes";
import type { TransactionTag } from "@/types/transactionTagTypes";
import { resolveTagStyleImageUrl } from "@/lib/tags/preset-style-images";
import { resolveIndexTransactionTagIds } from "@/utils/resolveIndexTransactionTagIds";

const tagsKey = (spaceCode: string): string =>
  `transactionTags:${spaceCode}`;

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const normalizeTransactionTag = (
  tag: Record<string, unknown>,
): TransactionTag => {
  const stylePresetKey = asOptionalString(
    tag.stylePresetKey ?? tag.style_preset_key,
  );
  const attachedStyleImageUrl = asOptionalString(
    tag.styleImageUrl ?? tag.style_image_url,
  );

  return {
    id: String(tag.id ?? ""),
    name: String(tag.name ?? ""),
    color: String(tag.color ?? ""),
    isDefault: Boolean(tag.isDefault ?? tag.is_default),
    stylePresetKey,
    styleImageUrl: resolveTagStyleImageUrl({
      styleImageUrl: attachedStyleImageUrl,
      stylePresetKey,
    }),
  };
};

export const normalizeTransactionTags = (
  rows: unknown,
): TransactionTag[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) =>
    normalizeTransactionTag((row ?? {}) as Record<string, unknown>),
  );
};

export const cacheTransactionTagsResponse = async (
  spaceCode: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    const tags = normalizeTransactionTags(payload);
    await putLocalResponseSnapshot(tagsKey(spaceCode), tags);
  } catch (error) {
    console.warn("[local-db] Failed to cache transaction tags", error);
  }
};

export const applyToggledDefaultTag = (
  tags: TransactionTag[],
  updated: TransactionTag,
): TransactionTag[] =>
  tags.map((tag) => {
    if (tag.id === updated.id) {
      return {
        ...tag,
        ...updated,
      };
    }

    if (updated.isDefault) {
      return {
        ...tag,
        isDefault: false,
      };
    }

    return tag;
  });

export const loadCachedTransactionTagsResponse = async (
  spaceCode: string,
): Promise<TransactionTag[] | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const cached = await getLocalResponseSnapshot<TransactionTag[]>(
      tagsKey(spaceCode),
    );
    if (!Array.isArray(cached)) {
      return undefined;
    }

    return cached;
  } catch (error) {
    console.warn("[local-db] Failed to load cached transaction tags", error);
    return undefined;
  }
};

export const loadTransactionTags = async (
  spaceCode: string,
): Promise<TransactionTag[]> =>
  (await loadCachedTransactionTagsResponse(spaceCode)) ?? [];

export const upsertTransactionTagInList = (
  tags: TransactionTag[],
  tag: TransactionTag,
): TransactionTag[] => {
  const index = tags.findIndex((row) => row.id === tag.id);

  if (index >= 0) {
    const next = [...tags];
    next[index] = tag;
    return next;
  }

  return [...tags, tag];
};

export const removeTransactionTagFromList = (
  tags: TransactionTag[],
  tagId: string,
): TransactionTag[] => tags.filter((tag) => tag.id !== tagId);

export const replaceTransactionTagIdInList = (
  tags: TransactionTag[],
  localId: string,
  serverId: string,
): TransactionTag[] =>
  tags.map((tag) => (tag.id === localId ? { ...tag, id: serverId } : tag));

type IndexTransactionWithTagIds = IndexTransaction & { tagIds?: string[] };

export const stripTagFromTransaction = (
  transaction: IndexTransactionWithTagIds,
  tagId: string,
): IndexTransactionWithTagIds => {
  const nextTags = (transaction.tags ?? []).filter((tag) => tag.id !== tagId);
  const nextTagIds = resolveIndexTransactionTagIds(transaction).filter(
    (id) => id !== tagId,
  );

  return {
    ...transaction,
    tags: nextTags,
    tagIds: nextTagIds,
  };
};

export const stripTagAssignmentsFromLocalTransactions = async (
  spaceCode: string,
  tagId: string,
): Promise<IndexTransactionWithTagIds[]> => {
  if (!spaceCode || !tagId) {
    return [];
  }

  const rows = await listSpaceTransactions(spaceCode);
  const previousTagged: IndexTransactionWithTagIds[] = [];
  const nextRows: IndexTransaction[] = [];

  for (const row of rows) {
    const taggedRow = row as IndexTransactionWithTagIds;
    const hasAssignment =
      resolveIndexTransactionTagIds(taggedRow).includes(tagId)
      || (taggedRow.tags ?? []).some((tag) => tag.id === tagId);

    if (!hasAssignment) {
      continue;
    }

    previousTagged.push(taggedRow);
    nextRows.push(stripTagFromTransaction(taggedRow, tagId));
  }

  await putSpaceTransactions(spaceCode, nextRows);
  return previousTagged;
};

export const restoreTagAssignmentsToLocalTransactions = async (
  spaceCode: string,
  previousRows: IndexTransaction[],
): Promise<void> => {
  if (!spaceCode || previousRows.length === 0) {
    return;
  }

  await putSpaceTransactions(spaceCode, previousRows);
};

export const applyTransactionTagsToCaches = async (params: {
  spaceCode: string;
  tags: TransactionTag[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, tags, queryClient } = params;

  await cacheTransactionTagsResponse(spaceCode, tags);

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["transactionTags", spaceCode], tags);
  queryClient.setQueryData(["transactionTags", "local", spaceCode], tags);
};
