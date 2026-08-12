import type { IndexTransaction } from "@/types/transactionTypes";
import type { TransactionTag } from "@/types/transactionTagTypes";

type RowWithTags = {
  tagIds?: string[];
  tags?: TransactionTag[];
};

/**
 * Prefer non-empty `tagIds`, then fall back to `tags[].id`.
 * Important: `tagIds: []` must NOT mask populated `tags` — empty arrays are
 * truthy for `??` and would make offline tag filters always miss.
 */
export const resolveIndexTransactionTagIds = (
  row: (IndexTransaction & RowWithTags) | RowWithTags | null | undefined,
): string[] => {
  if (!row) {
    return [];
  }

  if (Array.isArray(row.tagIds) && row.tagIds.length > 0) {
    return row.tagIds.filter((id) => Boolean(id));
  }

  if (Array.isArray(row.tags) && row.tags.length > 0) {
    return row.tags
      .map((tag) => tag?.id)
      .filter((id): id is string => Boolean(id));
  }

  return [];
};
