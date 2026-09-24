# Frontend source of truth: IndexedDB

**Status:** living architecture rule (offline-first, FIN-193).

After `offlineSyncReady`, **screens and hooks read IndexedDB**. The Rails API is a **sync layer**: bootstrap, outbox drain, change-log pull, and realtime writes *into* IndexedDB. It is not the live query engine for space-scoped UI.

## What this does *not* mean

The backend still **processes**. It persists writes, expands series, updates balances, rebuilds monthly financial summaries, enforces contracts, and broadcasts results. Those results are the canonical **facts**. The frontend stores the facts locally and **assembles screens** from them.

Do not interpret “backend is a sync layer” as “backend is a dumb pipe.” It is the authority for durable money state. The UI just does not wait on a second live GET to display that state.

## Split: facts vs views

| Kind of work | Owner | Example |
|--------------|--------|---------|
| Durable facts | **Backend**, then sync the *result* into IndexedDB | Transaction rows, account balances, monthly summary buckets, loan balances |
| Screen assembly | **Frontend** from IndexedDB | Insights hero, charts, narratives, filtered lists |
| Validation / enums | **Both**, via `@fintr/domain` | Create-transaction rules, repeat intervals |
| Optimistic UX | **Frontend**, replaced when the server fact lands | Local `local:` rows until outbox drain / realtime |

### Do not dual-process the same money

Reimplementing the same aggregation on FE and BE is what causes flicker and drift (Insights briefly summing ~44 period transactions, then flipping to monthly-bucket totals).

**Rule:** one calculator per number.

- If the number is a **persisted fact** (net / in / out, balances, monthly buckets), the backend computes it on write. The frontend **displays the synced artifact**. It may not re-sum a partial transaction slice and treat that as the hero total.
- If the number is **UI-only** (narrative copy, chart series, profile labels), the frontend computes it from local facts. The backend does not need a matching endpoint.
- If both layers *must* compute the same thing (rare), put the function in `@fintr/domain` and add a **parity fixture** — same as validation. Do not keep two ad-hoc implementations.

Insights already follow this: monthly buckets are authoritative for Net / In / Out; period transactions only enrich breakdowns and charts. See `resolveUnfilteredInsightsSummary` and `mergeUnfilteredInsightsBundle`.

## Read path (after sync)

```
IndexedDB  →  domain local-cache / offline calc  →  React Query  →  UI
                 ↑
        bootstrap / pull / realtime / outbox drain
                 ↑
              Rails API
```

- Hooks use `useSkipCachedNetworkFetch` (or equivalent `networkMode: "always"` **local** queries). They must not block first paint on `GET /insights`, `GET /dashboard`, etc.
- Online refetch is allowed only to **refresh IndexedDB** (write-through). The UI continues to read the local snapshot. Never replace a correct local snapshot with an empty/in-flight network result.
- React Query is a scheduler and cache of local reads, not a financial source. Default `networkMode: "online"` **pauses** both queries and mutations while offline — that blocks IndexedDB. Use `"always"` on every IDB read and every local-first / outbox mutation.

## Write path

1. Validate with `@fintr/domain` (same rules as `Dry::Validation::Contract`).
2. Patch React Query + IndexedDB + outbox (`*-local-first.ts`). UI is done here (`waitForSync: false`; do not await `syncPromise`).
3. Drain to Rails; server processes and persists.
4. Realtime / pull writes the **server result** back into IndexedDB (ids, balances, monthly buckets).

Until step 4, optimistic rows are approximations. After step 4, local facts match the server.

## Why this is not a huge consistency tax

Dual processing *is* hard if every screen reimplements backend math. This split avoids that:

- **Money facts** have one implementation (Rails operations). FE stores outputs.
- **Presentation** has one implementation (FE). BE does not re-serve composed insights as the UI source.
- **Shared rules** (what is valid) stay in `@fintr/domain` + Dry contracts + parity specs — cheap, already required for local-first writes.

The expensive path is “compute Net on the server *and* re-sum it from a different FE query.” Don’t do that.

## Static assets vs IndexedDB

Bundled illustrations (`/profiles/*.png`, `/badges/*.png`) live in the **service worker Cache Storage**, not IndexedDB. IndexedDB holds *user* data (transactions, summaries, **receipt blobs** in the `attachments` store). App chrome is precached.

## Related

- Manifest checklist: [`DATA_MANIFEST.md`](./DATA_MANIFEST.md)
- Dexie / local-first paths: [`apps/fintr-fe/docs/mobile/OFFLINE_INDEXEDDB_SPIKE.md`](../../apps/fintr-fe/docs/mobile/OFFLINE_INDEXEDDB_SPIKE.md)
- Validation parity: [`packages/fintr-domain/README.md`](../../packages/fintr-domain/README.md)
- Skills: `indexeddb-source-of-truth`, `offline-mode-data-manifest`, `shared-domain-validation`, `frontend-tdd`
- Rule: `.ai/rules/indexeddb_source_of_truth.mdc`
