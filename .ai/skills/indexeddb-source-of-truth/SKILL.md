---
name: indexeddb-source-of-truth
description: >-
  Use when adding or changing Fintr frontend screens, hooks, React Query, local-cache,
  insights, dashboard, offline mode, outbox, or any space-scoped read/write after
  offline sync — especially when a button hangs on "Saving"/"Recording" while
  offline, when tempted to GET from Rails for UI data, when totals flicker, or
  when FE and BE would both compute the same money figure.
---

# IndexedDB is the frontend source of truth

After `offlineSyncReady`, the UI reads **IndexedDB**. Rails is the **sync layer** (bootstrap, outbox, pull, realtime) and the authority for **durable facts**. It is not the live query engine for screens.

**Doc:** `docs/offline-mode/FRONTEND_SOURCE_OF_TRUTH.md`

## Iron law: React Query must not block IndexedDB

Do this **before** writing or changing any offline-first hook, screen, or `*-local-first.ts` path. Do not skip it because "the local-first function already exists."

TanStack Query v5 default `networkMode` is `"online"`:

| Call | Default while `navigator.onLine === false` | What the user sees |
|------|--------------------------------------------|--------------------|
| `useQuery` / `useInfiniteQuery` | `queryFn` does **not** run | Empty list, skeleton, "Failed to load" |
| `useMutation` | `mutationFn` does **not** run; stays `isPending` | Button stuck on "Recording…" / "Saving…" forever |

IndexedDB and the outbox do not need a network. React Query must not wait for one.

### Mandatory gate (every offline change)

1. List every `useQuery`, `useInfiniteQuery`, and `useMutation` on the read/write path.
2. If `queryFn` reads IndexedDB (`loadCached*`, Dexie, `local-cache.ts`): set `networkMode: "always"`.
3. If `mutationFn` writes IndexedDB + outbox (`*-local-first.ts`): set `networkMode: "always"`.
4. UI submits with `waitForSync: false`. Do **not** `await result.syncPromise` before closing the sheet or navigating.
5. Loading labels (`isPending`, "Recording…") must clear after the **local** write, not after Rails.

Write path is always:

```
validate → IndexedDB + React Query cache + outbox  →  UI done
                                              ↓
                                    drain to Rails later
```

If a mutation still uses default `networkMode: "online"`, the local-first function never runs while offline. The outbox never gets the row.

### Test that locks this

`onlineManager.setOnline(false)` + API mock that **never resolves**. Assert:

- the mutation/query finishes
- IndexedDB has the row
- outbox has the command
- `isPending` / `isCreating` is false

See `useLoanPayments.test.tsx` ("records a payment locally while offline without waiting for the API").

## Decision: process on FE vs BE

Do **not** run two independent calculators for the same money. That is the hard path (Insights Net flipping after ~500ms).

| Work | Where | Notes |
|------|--------|--------|
| Persisted facts (balances, monthly buckets, stored rows) | **BE**, sync result → IDB | One implementation |
| Screen assembly (charts, narratives, filters, hero from buckets) | **FE from IDB** | Instant + offline |
| Validation / enums | **Both** via `@fintr/domain` | Already required |
| Optimistic rows | **FE**, replaced by server fact | UX only |

Backend still processes writes. Frontend displays synced artifacts. Dual processing is only needed for **rules** (validation), not for **aggregates**.

## When implementing a screen

1. Run the **React Query gate** above.
2. Read `docs/offline-mode/DATA_MANIFEST.md` — is the domain in IDB?
3. Hook loads from `local-cache.ts` / Dexie / `offline-calculations.ts`.
4. `useSkipCachedNetworkFetch` (or equivalent) after sync — no blocking `GET /insights` / `GET /dashboard`.
5. Online network is write-through into IDB. Never replace a good local snapshot with pending/empty network data.
6. Writes: `@fintr/domain` → `*-local-first.ts` → outbox → Rails → pull/realtime updates IDB.

## Insights specifically

- Net / In / Out: **monthly buckets** (`resolveUnfilteredInsightsSummary`), not a partial period transaction sum.
- Transactions enrich breakdowns/charts only (`mergeUnfilteredInsightsBundle`).
- Profile PNGs: Cache Storage / blob URL, not IndexedDB.

## Anti-patterns

- Painting `GET` JSON as the dashboard while IDB already has buckets
- Re-summing period transactions as hero totals
- `networkMode: "online"` (the default) on IndexedDB **queries** — pauses offline → zeros / skeletons / "Failed to load"
- `networkMode: "online"` (the default) on IndexedDB **mutations** — pauses offline → "Recording…" forever, outbox empty
- `await syncPromise` / `waitForSync: true` on the UI submit path
- Duplicating Dry operation math in a one-off FE helper without `@fintr/domain` parity
- Storing bundled `/profiles/*.png` in IndexedDB (use Cache Storage)

## Related

- `frontend-tdd` — tests first, change, update tests, re-run
- `offline-mode-data-manifest` — coverage checklist
- `shared-domain-validation` — Zod / Dry parity
- Rule: `.ai/rules/indexeddb_source_of_truth.mdc`
