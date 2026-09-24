import * as SQLite from "expo-sqlite";

import type {
  LocalDbAdapter,
  MonthlySnapshotRow,
  OutboxRow,
  TransactionRow,
} from "./local-db-adapter";

const DB_NAME = "fintr-rn-local.db";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class SqliteLocalDbAdapter implements LocalDbAdapter {
  private db: SQLite.WebSQLDatabase;
  private initialized = false;

  constructor(dbName: string = DB_NAME) {
    this.db = SQLite.openDatabase(dbName);
  }

  init = async (): Promise<void> => {
    if (this.initialized) return;

    await new Promise<void>((resolve, reject) => {
      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `
              CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY NOT NULL,
                space_code TEXT NOT NULL,
                date_iso TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                currency TEXT NOT NULL,
                memo TEXT,
                created_at_ms INTEGER NOT NULL
              );
              CREATE INDEX IF NOT EXISTS idx_transactions_space_date
              ON transactions(space_code, date_iso);
            `,
          );

          tx.executeSql(
            `
              CREATE TABLE IF NOT EXISTS monthly_snapshots (
                space_code TEXT NOT NULL,
                month_key TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                PRIMARY KEY (space_code, month_key)
              );
            `,
          );

          tx.executeSql(
            `
              CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY NOT NULL,
                space_code TEXT NOT NULL,
                op_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL,
                processed_at_ms INTEGER
              );
              CREATE INDEX IF NOT EXISTS idx_outbox_space_processed
              ON outbox(space_code, processed_at_ms);
            `,
          );
        },
        (error) => reject(error),
        () => resolve(),
      );
    });

    this.initialized = true;
  };

  private query<T = unknown>(
    sql: string,
    params: unknown[],
    mapRow: (row: any) => T,
  ): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      this.db.transaction(
        (tx) => {
          tx.executeSql(
            sql,
            params as any[],
            (_, result) => {
              const rows = result?.rows;
              const out: T[] = [];
              if (rows) {
                for (let i = 0; i < rows.length; i++) {
                  out.push(mapRow(rows.item(i)));
                }
              }
              resolve(out);
            },
            (_tx, error) => reject(error),
          );
        },
        (error) => reject(error),
      );
    });
  }

  private exec(sql: string, params: unknown[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.transaction(
        (tx) => {
          tx.executeSql(
            sql,
            params as any[],
            () => resolve(),
            (_tx, error) => reject(error),
          );
        },
        (error) => reject(error),
      );
    });
  }

  listTransactionsInDateRange = async (params: {
    spaceCode: string;
    fromISO: string;
    toISO: string;
    limit: number;
    offset: number;
  }): Promise<TransactionRow[]> => {
    await this.init();

    const rows = await this.query(
      `
        SELECT
          id,
          space_code,
          date_iso,
          amount_cents,
          currency,
          memo,
          created_at_ms
        FROM transactions
        WHERE space_code = ?
          AND date_iso >= ?
          AND date_iso <= ?
        ORDER BY date_iso DESC, created_at_ms DESC
        LIMIT ?
        OFFSET ?
      `,
      [params.spaceCode, params.fromISO, params.toISO, params.limit, params.offset],
      (row) =>
        ({
          id: String(row.id),
          spaceCode: String(row.space_code),
          dateISO: String(row.date_iso),
          amountCents: Number(row.amount_cents),
          currency: String(row.currency),
          memo: row.memo !== null ? String(row.memo) : null,
          createdAtMs: Number(row.created_at_ms),
        }) satisfies TransactionRow,
    );

    return rows;
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
    await this.init();

    const { transaction } = params;

    await this.exec(
      `
        INSERT INTO transactions (
          id,
          space_code,
          date_iso,
          amount_cents,
          currency,
          memo,
          created_at_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          space_code = excluded.space_code,
          date_iso = excluded.date_iso,
          amount_cents = excluded.amount_cents,
          currency = excluded.currency,
          memo = excluded.memo,
          created_at_ms = excluded.created_at_ms
      `,
      [
        transaction.id,
        transaction.spaceCode,
        transaction.dateISO,
        transaction.amountCents,
        transaction.currency,
        transaction.memo ?? null,
        transaction.createdAtMs,
      ],
    );
  };

  getMonthlySnapshot = async (params: {
    spaceCode: string;
    monthKey: string;
  }): Promise<MonthlySnapshotRow | null> => {
    await this.init();

    const rows = await this.query(
      `
        SELECT
          space_code,
          month_key,
          snapshot_json,
          updated_at_ms
        FROM monthly_snapshots
        WHERE space_code = ?
          AND month_key = ?
        LIMIT 1
      `,
      [params.spaceCode, params.monthKey],
      (row) => {
        const snapshotJson = safeJsonParse<unknown>(String(row.snapshot_json));
        if (snapshotJson === null) {
          return null;
        }

        return {
          spaceCode: String(row.space_code),
          monthKey: String(row.month_key),
          snapshotJson,
          updatedAtMs: Number(row.updated_at_ms),
        } satisfies MonthlySnapshotRow;
      },
    );

    const first = rows.find(Boolean);
    return (first ?? null) as MonthlySnapshotRow | null;
  };

  upsertMonthlySnapshot = async (params: {
    spaceCode: string;
    monthKey: string;
    snapshotJson: unknown;
  }): Promise<void> => {
    await this.init();

    await this.exec(
      `
        INSERT INTO monthly_snapshots (space_code, month_key, snapshot_json, updated_at_ms)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(space_code, month_key)
        DO UPDATE SET
          snapshot_json = excluded.snapshot_json,
          updated_at_ms = excluded.updated_at_ms
      `,
      [
        params.spaceCode,
        params.monthKey,
        JSON.stringify(params.snapshotJson),
        Date.now(),
      ],
    );
  };

  enqueueOutbox = async (params: {
    spaceCode: string;
    opType: string;
    payloadJson: unknown;
  }): Promise<{ id: string }> => {
    await this.init();

    const id = `outbox_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await this.exec(
      `
        INSERT INTO outbox (id, space_code, op_type, payload_json, created_at_ms, processed_at_ms)
        VALUES (?, ?, ?, ?, ?, NULL)
      `,
      [
        id,
        params.spaceCode,
        params.opType,
        JSON.stringify(params.payloadJson),
        Date.now(),
      ],
    );

    return { id };
  };

  listOutbox = async (params: {
    spaceCode: string;
    limit: number;
  }): Promise<OutboxRow[]> => {
    await this.init();

    const rows = await this.query(
      `
        SELECT
          id,
          space_code,
          op_type,
          payload_json,
          created_at_ms,
          processed_at_ms
        FROM outbox
        WHERE space_code = ?
          AND processed_at_ms IS NULL
        ORDER BY created_at_ms ASC
        LIMIT ?
      `,
      [params.spaceCode, params.limit],
      (row) => {
        const payloadJson = safeJsonParse<unknown>(String(row.payload_json)) ?? null;

        return {
          id: String(row.id),
          spaceCode: String(row.space_code),
          opType: String(row.op_type),
          payloadJson,
          createdAtMs: Number(row.created_at_ms),
          processedAtMs: row.processed_at_ms !== null ? Number(row.processed_at_ms) : null,
        } satisfies OutboxRow;
      },
    );

    return rows;
  };

  markOutboxProcessed = async (params: {
    spaceCode: string;
    outboxIds: string[];
  }): Promise<void> => {
    await this.init();

    if (params.outboxIds.length === 0) return;

    const now = Date.now();
    const placeholders = params.outboxIds.map(() => "?").join(", ");

    await this.exec(
      `
        UPDATE outbox
        SET processed_at_ms = ?
        WHERE space_code = ?
          AND id IN (${placeholders})
      `,
      [now, params.spaceCode, ...params.outboxIds],
    );
  };
}

