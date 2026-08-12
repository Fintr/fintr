import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { TransactionTag } from "@/types/transactionTagTypes";

const tagsKey = (spaceCode: string): string =>
  `transactionTags:${spaceCode}`;

export const normalizeTransactionTag = (
  tag: Record<string, unknown>,
): TransactionTag => ({
  id: String(tag.id ?? ""),
  name: String(tag.name ?? ""),
  color: String(tag.color ?? ""),
  isDefault: Boolean(tag.isDefault ?? tag.is_default),
  styleImageUrl:
    typeof tag.styleImageUrl === "string"
      ? tag.styleImageUrl
      : typeof tag.style_image_url === "string"
        ? tag.style_image_url
        : undefined,
});

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
