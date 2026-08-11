# Offline IndexedDB (FIN-194)

## Decision

**Local storage: IndexedDB via Dexie**.

Why: one browser-native store on web + Capacitor WebView; Linear-style local-first apps commonly use IndexedDB. Native feel comes from bundled shell + UI/motion + instant local reads — not from IndexedDB vs SQLite.

## What’s in the repo

| Path | Role |
|------|------|
| `src/lib/local-db/` | Dexie DB (`fintr-local`), accounts + response snapshots + outbox |
| `src/services/transactions/accounts/local-cache.ts` | Accounts SWR helpers |
| `src/services/spaces/local-cache.ts` | Dashboard SWR helpers |
| `src/services/transactions/local-cache.ts` | Transactions index cache, series delete helpers, pending-row merge |
| `src/services/transactions/resolve-delete-scope.ts` | Series fingerprint + transfer-fee resolution (RQ + IDB) |
| `src/services/transactions/create-local-first.ts` | Optimistic income/expense create |
| `src/services/transactions/delete-local-first.ts` | Optimistic income/expense/transfer delete |
| `src/services/transactions/transfers/create-local-first.ts` | Optimistic transfer create (+ fee expense) |
| `src/services/transactions/transfers/fee-description.ts` | Shared transfer-fee label helper |
| `src/services/transactions/transfers/patch-transfer-fee-caches.ts` | Optimistic transfer update + fee patch |
| `src/services/transactions/transfers/reconcile-local-fees.ts` | Drop `local:*:fee` when server fee arrives |
| `src/services/local-sync/bootstrap-local-data.ts` | Backend → IndexedDB → React Query bootstrap (all workspaces) |
| `src/services/local-sync/drain-outbox.ts` | Ordered outbox drain (create/delete transfer + transaction) |
| `packages/fintr-domain` (`@fintr/domain`, **FIN-197**) | Shared Zod schemas + primitives mirroring BE `Dry::Validation` contracts — **required** for new validation; see `packages/fintr-domain/README.md` |
| `src/services/local-sync/offline-sync-messages.ts` | Rotating copy for the offline sync screen |
| `src/hooks/useOfflineSync.ts` | Runs full-workspace sync + gates first-time users on sync screen |
| `src/hooks/useTransactionsRealtime.ts` | ActionCable `TransactionsChannel` → IDB + RQ |
| `src/components/offline/offline-sync-screen.tsx` | Offline-ready progress UI |
| `scripts/mobile/build-production.sh` | **Default** store build = bundled `out/` (no remote `server.url`) |

## React Query wiring

Shared pattern (accounts, dashboard, transactions page 1):

1. **Bootstrap** (`useOfflineSync` in private layout): shows an offline-ready sync screen on first run (or after sync version bump), syncs **every workspace** with an **all-time** transaction pull (`2000-01-01` → `2099-12-31`), plus accounts, loans (with detail), categories, and transfer records. Dashboard totals come from **`GET /monthly_financial_summaries`** (raw monthly buckets — ~60 rows for 5 years) plus one dashboard shell fetch; the client combines buckets for any month range. Budgets are still fetched **per month** from the first transaction month through the current month. Transaction list views are sliced from the all-time cache locally (empty months still count as a cache hit — no network).
2. Per-hook: load IndexedDB snapshot as `placeholderData`
3. Fetch network; write-through on success
4. On network failure, serve IndexedDB when present
5. `isLoading` is false when a local snapshot exists
6. Network page fetches **re-merge** pending `local:` rows (transfers + fees) so a remount refetch cannot wipe optimistic creates (`mergePendingLocalIndexRowsIntoPage`)

## Offline read mode (after sync)

Once the offline sync screen completes (`offlineSyncReady`):

- **Offline:** dashboard / accounts / transactions / loans / categories / budgets / monthly-summary / insights hooks **read IndexedDB only** (including empty snapshots).
- **Online:** same hooks use IndexedDB as placeholder/cache but **refetch from the backend** on mount/focus so peer creates/deletes appear. Successful responses write through to IndexedDB.

Insights sections are computed client-side from the same inputs the backend uses:

- **Summary / financial trends** — monthly financial summary buckets
- **Expense breakdown / weekly spending** — local transactions
- **Financial health score** — summary + local budgets + local loans (DTI / budget usage / savings bands)

A background refresh (`refreshOnlineLocalCaches`) runs on tab focus while online
(throttled): drain outbox → pull the **current UI month** into IndexedDB →
invalidate React Query. It does **not** re-paginate the all-time bootstrap window
on every dashboard load (that flooded `/transactions`).

Note: `http://localhost:5173/api/v1/...` is still a **backend** call (Next.js proxies to Rails). When the device is offline, those URLs must not be hit.

Transactions keep the full history in IndexedDB for offline use; while online the list may also page from the network.

## Dev backend URL

Browser requests go to `http://localhost:5173/api/v1/*` (same origin). Next.js dev rewrites proxy to `NEXT_PUBLIC_BE_URL` (`http://localhost:3001`). **Rails must be running on port 3001** during the sync screen; after that, offline browsing uses IndexedDB and online browsing refetches.

## Bundled app shell (default production)

```bash
# from apps/fintr-fe
./scripts/mobile/build-production.sh
# or
./scripts/mobile/build-production-android.sh
# or
make ios-app
```

These **unset** `CAPACITOR_SERVER_URL` and verify `capacitor.config.json` has no `server.url`.

API traffic still uses `NEXT_PUBLIC_BE_URL` from `.env.mobile.production`.

`build-production-bundled.sh` is an alias of `build-production.sh`.

## Regression tests (keep these green)

| Area | Spec |
|------|------|
| Online vs offline read gate | `src/hooks/useOfflineReadMode.test.ts` |
| Local-first create / delete / outbox drain | `create-local-first.test.ts`, `delete-local-first.test.ts`, `drain-outbox.test.ts` |
| Transfer create + fee | `transfers/create-local-first.test.ts`, `transfers/fee-description.test.ts` |
| Series delete + fee resolution | `resolve-delete-scope.test.ts`, `delete-local-first.test.ts` (all_in_series) |
| Pending local merge after refetch | `local-cache-merge-pending.test.ts` |
| Optimistic list remove / upsert | `remove-from-query-caches.test.ts`, `upsert-into-query-caches.test.ts` |
| Peer pull + preserve pending `local:` creates | `bootstrap-local-data.test.ts` (`refreshOnlineLocalCaches`, preserve pending) |

## Layering (SRP)

| Layer | Owns |
|-------|------|
| `src/lib/local-db/` | Dexie schema, outbox, raw snapshots |
| `src/services/**/local-db.ts` / `local-cache.ts` / `detail-local.ts` | Domain read/write against local DB |
| `src/services/**/queries.ts` / `resolve-*.ts` / `*-local-first.ts` | Local-first + network fallback APIs |
| `src/hooks/**` | React Query wiring / offline gate / realtime |
| `src/components/**` | UI only — call services, do not import `local-db` helpers |

## Exchange rates in local DB

`resolveAutoExchangeRates` (used by the amount picker) and `getCurrentRate` / `getRecentRates` are local-first:

1. Read IndexedDB for the pair (+ date for current)
2. If missing, fetch the backend and write-through
3. Offline sync (version **6**) also prefetches pairs from space / account / transaction currencies

## Optimistic write order (all local-first mutations)

Unless noted otherwise:

1. **React Query** (instant UI)
2. **IndexedDB + outbox**
3. **Network** (`waitForSync: false` returns after step 2; `syncPromise` settles later)

Do **not** invalidate active `["transactions"]` lists until sync finishes when the mutation already patched RQ — a refetch can race and restore deleted rows or drop optimistic creates.

## Local-first creates (income / expense)

`createTransactionLocalFirst` (`src/services/transactions/create-local-first.ts`):

1. Build optimistic parent (`local:{clientMutationId}`) plus near-term series children (`local:{cid}:{n}`)
2. Patch React Query first, then persist IndexedDB + monthly summaries + outbox (`transaction.create`)
3. `POST /transactions` including `clientMutationId` (BE idempotent via `sync_client_mutations`)
4. On success: replace parent id; drop optimistic children (realtime delivers server children); re-assert parent in RQ — **do not** invalidate active `["transactions"]` lists
5. On network failure: keep local series + outbox `pending`
6. On validation error: roll back local series/outbox/RQ and surface the error

Ordered drain: `drainAllOutboxes` / `drainOutboxForSpace` process pending rows by `createdAt` after offline sync and on `online`. Wired from `ExpenseForm` / `IncomeForm` with `waitForSync: false`.

## Local-first creates (transfers + fees)

`createTransferLocalFirst` (`src/services/transactions/transfers/create-local-first.ts`):

1. Build optimistic transfer row (`local:{clientMutationId}`) plus near-term series children (`local:{cid}:{n}`), same window as income/expense
2. If `transactionCost > 0`, build a **Transfer Fee** expense per occurrence (`local:{cid}:fee`, `local:{cid}:{n}:fee`)
3. Patch React Query with all transfers **and** fees, then persist to IndexedDB + outbox (`transfer.create`)
4. `POST /transactions/transfers`; on success replace parent transfer id; drop optimistic children (+ child fees); keep parent local fee until realtime delivers the server fee (deduped via `reconcile-local-fees`)
5. Network page refetches re-merge any remaining `local:` rows so fees do not disappear before broadcast
6. Backend `CreateRepeatTransfers` broadcasts child transfers **and** their fees together (`created_many`)

### Transfer fee label

Shared by FE (`fee-description.ts`) and BE (`Transactions::Transfer#fee_transaction_description`):

- With note: `Transfer fee for: <note>, amount: <transfer amount>`
- Without note: `Transfer fee, amount: <transfer amount>`

(`amount` is the **transfer** amount, not the fee.)

Wired from `TransferForm` with `waitForSync: false`.

## Local-first deletes (income / expense / transfer)

`deleteTransactionLocalFirst` (`src/services/transactions/delete-local-first.ts`):

1. **Instant RQ patch** from the clicked `listRow` (and, for series scopes, siblings + fees already loaded in React Query)
2. Prefer `listRow.inSeries` over a stale IndexedDB flag when resolving series scope
3. Resolve series members via fingerprint (`resolve-delete-scope.ts`) across **RQ + IndexedDB** (sibling `inSeries` flags may be stale and are not required)
4. For transfers: also remove linked **Transfer Fee** expenses matching the fee label / account / date scope
5. Persist removals to IndexedDB + enqueue outbox (`transaction.delete` or `transfer.delete`)
6. Never-synced `local:` rows cancel the matching create outbox (no server DELETE)
7. On network failure: keep local removal + outbox `pending`
8. On server errors for income/expense (including “not found”): keep local removal, drop outbox

Series scopes:

| Scope | Behavior |
|-------|----------|
| `this_only` | Clicked row (+ its fee on that date for transfers) |
| `this_and_future` | Fingerprint matches with `date >= target` (+ fees in that range) |
| `all_in_series` | All fingerprint matches (+ all matching fees) |

Wired from edit dialog + transaction/category/account list deletes with `waitForSync: false`.

## Transfer updates

`patchTransferAndFeeCaches` runs before/after `updateTransfer` in `EditTransactionDialog` so the transfer and fee appear/update immediately. Parent `onSuccess` should pass `skipTransactionsInvalidate: true` for transfers to avoid refetch races.

## Newly granted workspaces

When a user is invited / granted access to another space:

1. The spaces membership list refreshes while **online** (even after offline-ready)
2. `getUnsyncedSpaceCodes` compares access list vs `offlineSyncMeta.spaceCodes`
3. `syncNewlyAccessibleWorkspaces` / switch-space path downloads that space’s full offline payload
4. Only successfully synced codes are merged into sync meta

## Online conflict policy (presence)

Edit dialog subscribes to ActionCable `TransactionEditingChannel` (`transaction_editing:{spaceId}:{transactionId}`). Peers see who is editing; fields are read-only until they leave (Cancel still works). Offline concurrent edits (no presence) fall back to server-wins on sync.

## Realtime list creates / updates / deletes

Dashboard layout subscribes to ActionCable `TransactionsChannel` (`transactions:{spaceId}`).

Backend: `Transactions::Broadcasts::TransactionChange` (create/update/delete, including `created_many` / `updated_many` for transfer + fee batches).

- **Create:** `transaction_created` → RQ first (instant), then IndexedDB + monthly summaries. Transfer creates broadcast the transfer **and** fee expenses together when present.
- **Update:** `transaction_updated` → IDB upsert + RQ (new fees upsert without a remove-first wipe)
- **Delete:** `transaction_deleted` → IndexedDB remove + matching lists/totals
- **Actor toasts:** peers see who changed a row; suppressed for self via `authId` / `suppressActorToast`
- **Combined-view lag:** if the SQL `combined_transactions` view is not ready for a freshly inserted fee, BE falls back to serializing the transactable directly so fees still broadcast

Cable auth uses `AuthContext` / `useAuthApi.getToken`. The WebSocket URL hits Rails `/cable` via `NEXT_PUBLIC_BE_URL` (`getActionCableBackendUrl`) — Next’s `/api/v1` rewrite does not proxy ActionCable.

## Not done yet (follow-ups outside this spike)

- Full v2 sync pull API (FIN-196) — see [SPACE_SYNC_CHANGE_LOG.md](./SPACE_SYNC_CHANGE_LOG.md)
- Local attachment blobs for receipts (FIN-202) — create outbox + pull/cache; not just `hasImage`
- Encryption at rest (FIN-201)
- Local-first **loan payment** create/update (loan create/delete partial coverage exists)
- Local-first income/expense **update** writes (create/delete are covered; edits still largely online + invalidate)
