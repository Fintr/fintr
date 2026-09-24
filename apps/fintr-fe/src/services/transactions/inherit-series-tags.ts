import { resolveIndexTransactionTagIds } from "@/utils/resolveIndexTransactionTagIds";
import type { IndexTransactionWithCategoryIds } from "@/services/transactions/upsert-into-query-caches";

type TaggedIndexRow = IndexTransactionWithCategoryIds & {
  tagIds?: string[];
};

/**
 * Series children often arrive from realtime without tags. Copy tags from the
 * optimistic placeholder or the series parent so IndexedDB stays consistent.
 */
export const inheritSeriesTagsFromLocalContext = (params: {
  incoming: TaggedIndexRow;
  placeholders?: TaggedIndexRow[];
  parent?: TaggedIndexRow | null;
}): TaggedIndexRow => {
  const { incoming, placeholders = [], parent } = params;
  if (resolveIndexTransactionTagIds(incoming).length > 0) {
    return incoming;
  }

  const sources = [...placeholders, parent].filter(
    (source): source is TaggedIndexRow => Boolean(source),
  );

  for (const source of sources) {
    const tagIds = resolveIndexTransactionTagIds(source);
    if (tagIds.length === 0) {
      continue;
    }

    return {
      ...incoming,
      tags: source.tags?.length ? source.tags : incoming.tags,
      tagIds: source.tagIds ?? tagIds,
    };
  }

  return incoming;
};
