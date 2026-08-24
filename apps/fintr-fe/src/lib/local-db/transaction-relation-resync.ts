import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "./response-cache";

/** Bump when clients must re-pull transactions to stamp relation ids in IndexedDB. */
export const TRANSACTION_RELATION_IDS_RESYNC_VERSION = 1;

const TRANSACTION_RELATION_IDS_RESYNC_META_KEY =
  "transactionRelationIdsResyncMeta";

export type TransactionRelationIdsResyncMeta = {
  version: number;
  completedAt: number;
};

export const getTransactionRelationIdsResyncVersion = async (): Promise<number> => {
  const meta = await getLocalResponseSnapshot<TransactionRelationIdsResyncMeta>(
    TRANSACTION_RELATION_IDS_RESYNC_META_KEY,
  );

  return meta?.version ?? 0;
};

export const shouldResyncTransactionRelationIds = async (): Promise<boolean> =>
  (await getTransactionRelationIdsResyncVersion())
  < TRANSACTION_RELATION_IDS_RESYNC_VERSION;

export const markTransactionRelationIdsResyncComplete = async (): Promise<void> => {
  await putLocalResponseSnapshot(TRANSACTION_RELATION_IDS_RESYNC_META_KEY, {
    version: TRANSACTION_RELATION_IDS_RESYNC_VERSION,
    completedAt: Date.now(),
  });
};
