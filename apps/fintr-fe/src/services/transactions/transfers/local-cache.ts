import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

const transferDetailKey = (spaceCode: string, transferId: string): string =>
  `transferDetail:${spaceCode}:${transferId}`;

export const cacheTransferDetail = async (
  spaceCode: string,
  transferId: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceCode || !transferId) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      transferDetailKey(spaceCode, transferId),
      payload,
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache transfer detail", error);
  }
};

export const loadCachedTransferDetail = async (
  spaceCode: string,
  transferId: string,
): Promise<unknown | undefined> => {
  if (!spaceCode || !transferId) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot(
      transferDetailKey(spaceCode, transferId),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached transfer detail", error);
    return undefined;
  }
};
