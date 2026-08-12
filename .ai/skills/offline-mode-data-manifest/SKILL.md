---
name: offline-mode-data-manifest
description: >-
  Offline-first data coverage for Fintr: what bootstrap v2 must include, IndexedDB
  keys, React Query gates, and sync pull ops. Use when implementing offline mode,
  bootstrap/sync changes, local-cache, or when a screen still network-fetches after
  sync (e.g. tags, entities, merchants).
---

# Offline mode data manifest

**Source of truth:** [`docs/offline-mode/DATA_MANIFEST.md`](../../../docs/offline-mode/DATA_MANIFEST.md)

Read the manifest before adding features, fixing offline spinners, or extending bootstrap v2.

## Principle

> After `offlineSyncReady`, every **space-scoped** user screen must work without network.

Bootstrap v2 does **not** automatically include new domains. Each dataset needs an explicit row in the manifest and implementation in bootstrap + IDB + RQ + (optional) sync pull + local-first writes.

## Quick diagnosis: "why does X still load from the API?"

1. Open [`DATA_MANIFEST.md`](../../../docs/offline-mode/DATA_MANIFEST.md) — find domain status
2. If ❌: expected until manifest row is ✅
3. Trace hook → does it use `useSkipCachedNetworkFetch` and a local cache query?
4. Trace bootstrap → is payload in `Sync::Operations::BootstrapSpace` and `bootstrapSpaceV2`?

**Known gaps (2026-08):** entity detail, account activities, note suggestions, drafts, achievements. Tags/entities bootstrap + offline reads are implemented; sync pull + local-first writes still pending.

## Bootstrap v2 touchpoints

| Layer | Path |
|-------|------|
| BE bundle | `apps/fintr-be/app/operations/sync/operations/bootstrap_space.rb` |
| FE types | `apps/fintr-fe/src/types/syncTypes.ts` → `SyncBootstrapResponse` |
| FE apply | `apps/fintr-fe/src/services/local-sync/bootstrap-v2.ts` |
| Legacy path | `apps/fintr-fe/src/services/local-sync/bootstrap-local-data.ts` (v1 fallback) |

Tiers: **0** = shell (space, accounts, categories, current month) · **1** = full transactions + cursor · **2** = budgets, loans, transfers, rates.

## Implementation pattern (new domain)

Follow existing domains (`categories/local-cache.ts`, `useTransactionCategories.ts`):

1. **Manifest** — add row to `DATA_MANIFEST.md`
2. **BE** — `load_*` step in `BootstrapSpace`; serializer shape matches existing REST endpoint
3. **Types** — extend `SyncBootstrapResponse`
4. **local-cache.ts** — `cache*Response`, `loadCached*Response`, snapshot key convention
5. **bootstrap-v2.ts** — apply in appropriate tier; seed RQ `["domain", "local", spaceCode]`
6. **Hook** — local `useQuery` + network `useQuery` with `enabled: !skipNetwork`
7. **Sync pull** — add `SpaceChangeOp` + handler in `apply-change.ts` if peers mutate
8. **Writes** — `*-local-first.ts` + outbox if offline mutations required
9. **Tests** — bootstrap test + hook/offline gate test
10. **Version bump** — `OFFLINE_SYNC_VERSION` in `sync-state.ts` when existing installs need re-sync

## Online-only exceptions

Do **not** bootstrap these unless product explicitly changes scope:

- AI / RAG / conversations
- CRM tickets
- Admin APIs
- Import upload pipeline (show offline UX, not spinner)
- Optional: subscriptions/billing — confirm with product

Document new exceptions in the manifest **Online-only** section.

## PR checklist (paste into offline PRs)

```markdown
- [ ] Row added/updated in docs/offline-mode/DATA_MANIFEST.md
- [ ] BootstrapSpace includes payload
- [ ] bootstrapSpaceV2 caches + seeds RQ
- [ ] useSkipCachedNetworkFetch on read hook
- [ ] SpaceChangeOp + apply-change (if peer sync needed)
- [ ] local-first + outbox (if offline writes)
- [ ] Manual: airplane mode smoke on affected screen
```

## Related skills

- `shared-domain-validation` — Zod/Dry parity for local-first writes
- `gsd-graphify` — explore bootstrap/sync dependencies
