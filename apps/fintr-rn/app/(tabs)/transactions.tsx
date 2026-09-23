import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { createLocalDbAdapter } from '@/src/db';
import type { OutboxRow, TransactionRow } from '@/src/db';
import { useTabSwitchTiming } from '@/src/perf/use-tab-switch-timing';

const SPACE_CODE = 'test-space';

function formatMoney(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  return `${currency} ${amount.toFixed(2)}`;
}

export default function TransactionsScreen() {
  useTabSwitchTiming({
    tabLabel: 'Transactions',
    matchPath: '/transactions',
  });
  const adapter = useMemo(() => createLocalDbAdapter(), []);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = async () => {
    const now = new Date();
    const toISO = now.toISOString().slice(0, 10);

    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const fromISO = from.toISOString().slice(0, 10);

    const nextTransactions = await adapter.listTransactionsInDateRange({
      spaceCode: SPACE_CODE,
      fromISO,
      toISO,
      limit: 50,
      offset: 0,
    });

    const nextOutbox = await adapter.listOutbox({
      spaceCode: SPACE_CODE,
      limit: 100,
    });

    setTransactions(nextTransactions);
    setOutboxRows(nextOutbox);
  };

  useEffect(() => {
    void (async () => {
      await adapter.init();
      await refresh();
    })();
  }, [adapter]);

  const handleAddSample = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const now = Date.now();
      const dateISO = new Date(now).toISOString().slice(0, 10);
      const id = `tx_${now}`;

      await adapter.upsertTransaction({
        transaction: {
          id,
          spaceCode: SPACE_CODE,
          dateISO,
          amountCents: 12345,
          currency: 'PHP',
          memo: 'Sample offline transaction',
          createdAtMs: now,
        },
      });

      await adapter.enqueueOutbox({
        spaceCode: SPACE_CODE,
        opType: 'transactions/create',
        payloadJson: { transactionId: id },
      });

      await refresh();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSimulateSyncDrain = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const queued = await adapter.listOutbox({
        spaceCode: SPACE_CODE,
        limit: 50,
      });

      await adapter.markOutboxProcessed({
        spaceCode: SPACE_CODE,
        outboxIds: queued.map((row) => row.id),
      });

      await refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transactions</Text>

      <Text style={styles.subtitle}>Offline-first demo (SQLite + outbox)</Text>

      <View style={styles.buttonsRow}>
        <Pressable
          onPress={handleAddSample}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
            isBusy ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.buttonText}>Add sample</Text>
        </Pressable>

        <Pressable
          onPress={handleSimulateSyncDrain}
          disabled={isBusy || outboxRows.length === 0}
          style={({ pressed }) => [
            styles.buttonSecondary,
            pressed ? styles.buttonSecondaryPressed : null,
            isBusy || outboxRows.length === 0 ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.buttonTextSecondary}>
            Simulate sync drain ({outboxRows.length})
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Cached transactions ({transactions.length})
        </Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No cached transactions yet. Tap “Add sample”.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {transactions.slice(0, 10).map((tx) => (
            <View key={tx.id} style={styles.listRow}>
              <Text style={styles.listRowLeft}>{tx.dateISO}</Text>
              <Text style={styles.listRowRight}>
                {formatMoney(tx.amountCents, tx.currency)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    backgroundColor: '#2f95dc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(47,149,220,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 180,
  },
  buttonSecondaryPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextSecondary: {
    color: '#2f95dc',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginTop: 18,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  emptyState: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    opacity: 0.7,
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    marginTop: 10,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.15)',
  },
  listRowLeft: {
    fontSize: 13,
    opacity: 0.85,
  },
  listRowRight: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.95,
  },
});

