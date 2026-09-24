export type TransactionRow = {
  id: string;
  spaceCode: string;
  dateISO: string; // YYYY-MM-DD
  amountCents: number;
  currency: string;
  memo?: string | null;
  createdAtMs: number;
};

export type MonthlySnapshotRow = {
  spaceCode: string;
  monthKey: string; // YYYY-MM (or whatever your FE uses)
  snapshotJson: unknown;
  updatedAtMs: number;
};

export type OutboxRow = {
  id: string;
  spaceCode: string;
  opType: string;
  payloadJson: unknown;
  createdAtMs: number;
  processedAtMs: number | null;
};

export type LocalDbAdapter = {
  init: () => Promise<void>;

  // Transactions read slice
  listTransactionsInDateRange: (params: {
    spaceCode: string;
    fromISO: string;
    toISO: string;
    limit: number;
    offset: number;
  }) => Promise<TransactionRow[]>;

  // Transactions write for optimistic UI
  upsertTransaction: (params: {
    transaction: {
      id: string;
      spaceCode: string;
      dateISO: string; // YYYY-MM-DD
      amountCents: number;
      currency: string;
      memo?: string | null;
      createdAtMs: number;
    };
  }) => Promise<void>;

  // Dashboard header snapshot (month-based)
  getMonthlySnapshot: (params: {
    spaceCode: string;
    monthKey: string;
  }) => Promise<MonthlySnapshotRow | null>;

  upsertMonthlySnapshot: (params: {
    spaceCode: string;
    monthKey: string;
    snapshotJson: unknown;
  }) => Promise<void>;

  // Outbox queue (local-first writes)
  enqueueOutbox: (params: {
    spaceCode: string;
    opType: string;
    payloadJson: unknown;
  }) => Promise<{ id: string }>;

  listOutbox: (params: { spaceCode: string; limit: number }) => Promise<
    OutboxRow[]
  >;

  markOutboxProcessed: (params: {
    spaceCode: string;
    outboxIds: string[];
  }) => Promise<void>;
};

