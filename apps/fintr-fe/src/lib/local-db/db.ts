import Dexie, { type EntityTable } from "dexie";

import type { LocalAttachmentRecord } from "@/services/attachments/types";

import type {
  LocalAccountRecord,
  LocalMetaRecord,
  LocalOutboxRecord,
  LocalTransactionRecord,
} from "./types";

export const LOCAL_DB_SCHEMA_VERSION = 3;

/**
 * Client-side IndexedDB (Dexie) for offline-first reads.
 * Same path on web and Capacitor WebView.
 * Schema bumps go in version() chains — never mutate an existing store in place.
 */
export class FintrLocalDatabase extends Dexie {
  accounts!: EntityTable<LocalAccountRecord, "key">;
  attachments!: EntityTable<LocalAttachmentRecord, "key">;
  outbox!: EntityTable<LocalOutboxRecord, "id">;
  meta!: EntityTable<LocalMetaRecord, "key">;
  transactions!: EntityTable<LocalTransactionRecord, "key">;

  constructor(name = "fintr-local") {
    super(name);

    this.version(1).stores({
      accounts: "key, spaceId, id, cachedAt",
      outbox: "id, spaceId, status, createdAt, clientMutationId",
      meta: "key",
    });

    this.version(2).stores({
      accounts: "key, spaceId, id, cachedAt",
      outbox: "id, spaceId, status, createdAt, clientMutationId",
      meta: "key",
      transactions: "key, spaceId, id, date, type, [spaceId+date]",
    });

    this.version(LOCAL_DB_SCHEMA_VERSION).stores({
      accounts: "key, spaceId, id, cachedAt",
      attachments:
        "key, spaceId, ownerType, ownerId, lastAccessedAt, [spaceId+ownerType+ownerId]",
      outbox: "id, spaceId, status, createdAt, clientMutationId",
      meta: "key",
      transactions: "key, spaceId, id, date, type, [spaceId+date]",
    });
  }
}

let dbInstance: FintrLocalDatabase | null = null;

export const getLocalDb = (): FintrLocalDatabase => {
  if (!dbInstance) {
    dbInstance = new FintrLocalDatabase();
  }

  return dbInstance;
};

export const closeLocalDbInstanceForTests = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

export const resetLocalDbForTests = async (): Promise<void> => {
  if (dbInstance) {
    const name = dbInstance.name;
    dbInstance.close();
    dbInstance = null;
    await Dexie.delete(name);
    return;
  }

  await Dexie.delete("fintr-local");
};

export const getLocalDbSchemaVersion = async (): Promise<number> => {
  const db = getLocalDb();
  await db.open();
  return db.verno;
};
