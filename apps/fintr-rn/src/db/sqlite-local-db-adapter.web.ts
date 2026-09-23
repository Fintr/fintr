import type {
  LocalDbAdapter,
  MonthlySnapshotRow,
  OutboxRow,
  TransactionRow,
} from "./local-db-adapter";

/**
 * Web fallback: Expo SQLite requires a WASM module that doesn't bundle cleanly
 * in this environment. For the feasibility spike we only need the same
 * adapter surface for fast UI benchmarking.
 */
export class SqliteLocalDbAdapter implements LocalDbAdapter {
  private initialized = false;

  private transactions = new Map<string, TransactionRow>();
  private monthlySnapshots = new Map<string, MonthlySnapshotRow>();
  private outbox = new Map<string, OutboxRow>();

  init = async (): Promise<void> => {
    this.initialized = true;
  };

  listTransactionsInDateRange = async (params: {
    spaceCode: string;
    fromISO: string;
    toISO: string;
    limit: number;
    offset: number;
  }): Promise<TransactionRow[]> => {
    if (!this.initialized) await this.init();

    const from = params.fromISO;
    const to = params.toISO;

    const all = Array.from(this.transactions.values()).filter(
      (tx) =>
        tx.spaceCode === params.spaceCode &&
        tx.dateISO >= from &&
        tx.dateISO <= to,
    );

    all.sort((a, b) => {
      if (a.dateISO === b.dateISO) return b.createdAtMs - a.createdAtMs;
      return b.dateISO.localeCompare(a.dateISO);
    });

    return all.slice(params.offset, params.offset + params.limit);
  };

  upsertTransaction = async (params: {
    transaction: {
      id: string;
      spaceCode: string;
      dateISO: string;
      amountCents: number;
      currency: string;
      memo?: string | null;
      createdAtMs: number;
    };
  }): Promise<void> => {
    if (!this.initialized) await this.init();

    const tx = params.transaction;
    this.transactions.set(tx.id, {
      id: tx.id,
      spaceCode: tx.spaceCode,
      dateISO: tx.dateISO,
      amountCents: tx.amountCents,
      currency: tx.currency,
      memo: tx.memo ?? null,
      createdAtMs: tx.createdAtMs,
    });
  };

  getMonthlySnapshot = async (params: {
    spaceCode: string;
    monthKey: string;
  }): Promise<MonthlySnapshotRow | null> => {
    if (!this.initialized) await this.init();
    const key = `${params.spaceCode}__${params.monthKey}`;
    return this.monthlySnapshots.get(key) ?? null;
  };

  upsertMonthlySnapshot = async (params: {
    spaceCode: string;
    monthKey: string;
    snapshotJson: unknown;
  }): Promise<void> => {
    if (!this.initialized) await this.init();
    const key = `${params.spaceCode}__${params.monthKey}`;

    this.monthlySnapshots.set(key, {
      spaceCode: params.spaceCode,
      monthKey: params.monthKey,
      snapshotJson: params.snapshotJson,
      updatedAtMs: Date.now(),
    });
  };

  enqueueOutbox = async (params: {
    spaceCode: string;
    opType: string;
    payloadJson: unknown;
  }): Promise<{ id: string }> => {
    if (!this.initialized) await this.init();

    const id = `outbox_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const row: OutboxRow = {
      id,
      spaceCode: params.spaceCode,
      opType: params.opType,
      payloadJson: params.payloadJson,
      createdAtMs: Date.now(),
      processedAtMs: null,
    };

    this.outbox.set(id, row);
    return { id };
  };

  listOutbox = async (params: { spaceCode: string; limit: number }) => {
    if (!this.initialized) await this.init();

    const rows = Array.from(this.outbox.values()).filter(
      (row) => row.spaceCode === params.spaceCode && row.processedAtMs === null,
    );

    rows.sort((a, b) => a.createdAtMs - b.createdAtMs);
    return rows.slice(0, params.limit);
  };

  markOutboxProcessed = async (params: {
    spaceCode: string;
    outboxIds: string[];
  }): Promise<void> => {
    if (!this.initialized) await this.init();

    const now = Date.now();
    for (const id of params.outboxIds) {
      const row = this.outbox.get(id);
      if (!row) continue;
      if (row.spaceCode !== params.spaceCode) continue;

      this.outbox.set(id, {
        ...row,
        processedAtMs: now,
      });
    }
  };
}

