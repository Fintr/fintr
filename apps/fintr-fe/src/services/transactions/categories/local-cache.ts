import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

const categoriesKey = (spaceCode: string): string =>
  `transactionCategories:${spaceCode}`;

export const cacheTransactionCategoriesResponse = async (
  spaceCode: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    await putLocalResponseSnapshot(categoriesKey(spaceCode), payload);
  } catch (error) {
    console.warn("[local-db] Failed to cache transaction categories", error);
  }
};

export const loadCachedTransactionCategoriesResponse = async (
  spaceCode: string,
): Promise<unknown | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot(categoriesKey(spaceCode));
  } catch (error) {
    console.warn("[local-db] Failed to load cached transaction categories", error);
    return undefined;
  }
};
