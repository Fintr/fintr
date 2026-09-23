# RN Feasibility Decision & Migration Roadmap

## What we measured (and what we could not)

### RN prototype (Expo web, auto-benchmark)
We instrumented tab-switch timings with `useTabSwitchTiming` and an automated tab cycle:
Home → Transactions → Dashboard → Menu → Home.

Captured console logs (Expo web, automated run):
- `Transactions`: **24ms**
- `Dashboard`: **23ms**
- `Menu`: **19ms**
- `Home`: **19ms**

These numbers reflect “time from navigation initiation to destination screen’s first focused render hook”.
They are likely *optimistic* because the prototype is still mostly placeholder UI and the navigation tree can keep screens mounted.

### Web baseline measurement (Capacitor WebView)
Attempts to run the existing Playwright web baseline (`offline-navigation.spec.ts` + a custom benchmark) were blocked by the app not transitioning out of the cold-start `app-loading-screen` in this environment.

We also instrumented the benchmark page and confirmed:
- `localStorage.spaceCode` and `fintr_auth_data` were present
- Auth0-compatible keys existed
- The splash remained visible and the dashboard bottom nav never appeared

Because of that, we do **not** have a trustworthy “web median/p95 tab-switch time” to compare against.

## Recommendation

### Recommendation (practical)
1. **Keep investing in the optimized Capacitor web approach until the e2e baseline is unblocked.**
   - RN can certainly feel fast, but a full offline-first RN rewrite is a large bet.
2. Proceed with **RN migration only if** after unblocking the web baseline:
   - the web p95 tab-switch timing remains meaningfully above your target, even after further targeted optimizations, **or**
   - the app’s remaining slowness is dominated by factors that are fundamentally hard to fix in the web stack (e.g., deep IDB/virtualization bottlenecks that won’t shrink without architectural change).

### Why this recommendation is defensible with current evidence
- RN tab-switch focus timings in the prototype are consistently in the ~20ms range, indicating the *navigation pattern* can be fast.
- But we cannot yet show that RN retains those timings under **real data volume, offline sync gates, and remount/keep-alive semantics** that mirror the production web problem.
- Meanwhile, the web baseline is currently blocked, so we are missing the main “apples-to-apples” evidence.

## Migration Roadmap (tab-by-tab + offline parity)

Below is a staged plan that preserves the current architecture goal:
**Backend remains the sync layer. RN UI is local-first and uses an outbox for local-first writes.**

### Phase 0 — RN infrastructure that must exist before porting screens
1. **Local DB schema parity**
   - transactions (indexed ranges, pagination / anchors)
   - monthly/insight summary snapshots
   - attachments cache metadata (at minimum: URL → blob key mapping)
   - outbox table/queue
2. **Outbox drain loop**
   - enqueue local mutations
   - drain to backend when “online & sync-ready”
   - mark outbox processed (and handle failures with retries / backoff)
3. **Offline sync gating**
   - a single “offline sync ready” gate analogous to `offlineSyncReadyAtom`
   - keep cold-start splash short and deterministic (no endless loading gates)
4. **Tab keep-alive strategy**
   - ensure tab screens remain mounted (or aggressively preloaded)
   - restore scroll per tab to prevent “UI tax” on return

### Phase 1 — Port Transactions first (offline-first loop)
Goal: replicate the core “local reads + optimistic write + outbox queue”.

1. Transactions list screens
   - render from local transactions range query
   - support anchor navigation (“to today”, infinite scrolling)
2. Optimistic write flow
   - local insert/update (transactions table)
   - enqueue outbox row with mutation payload
3. Sync drain UI behavior (even if sync is stubbed initially)
   - show pending/outbox count indicators
   - confirm local view updates immediately

**Acceptance checklist**
- Tab switch feels instant with cached data.
- Add/modify a transaction shows immediately.
- Reloading the app keeps the cached list intact.
- Outbox queue persists across app restarts.

### Phase 2 — Home
Goal: prove that “fast header + cached tiles” are consistent.
1. Local header render
   - monthly snapshot read
2. Recent transactions block
   - local range query (newest-first limit)
3. Any home-level mutations (if present)
   - route them through outbox as “transactions” does

**Acceptance checklist**
- Home renders without waiting on the network.
- Tab return does not cause scroll/jank regressions.

### Phase 3 — Dashboard (Insights)
Goal: port summary snapshots + charts data.
1. Monthly & weekly summaries
   - local snapshot reads
2. Filters (if present)
   - map filter changes to local queries (not network)
3. AI insights / narrative (if required)
   - keep network-only portions behind explicit “loading” affordances

**Acceptance checklist**
- Dashboard renders from cached snapshot even offline.
- Filter changes do not trigger full expensive re-renders.

### Phase 4 — Menu (App settings + space management)
Goal: prove mutation correctness + offline persistence.
1. Read settings from local snapshot or cached workspace state
2. Mutations enqueue outbox and update local view optimistically
3. For destructive or “workspace switch” flows
   - ensure you can safely reset local slice or mark it invalid until re-sync

**Acceptance checklist**
- Space management works offline-first (at least: UI doesn’t hang).
- Returning to Menu shows expected cached state.

## Offline parity checklist (must not regress)

1. **Source of truth**
   - RN UI reads from local DB
   - backend is write+sync layer only
2. **Outbox correctness**
   - queue persists
   - local mutations apply even before drain succeeds
   - processed status updates are idempotent
3. **Sync conflict policy**
   - define whether “last write wins” is acceptable or needs reconciliation
4. **Attachments**
   - confirm caching strategy (offline blob mapping and retrieval)
5. **Performance invariants**
   - keep tab screens mounted (or cache heavy computations)
   - cache “derived view models” from raw tables

## Concrete next actions

1. **Unblock web baseline measurement**
   - fix the e2e hydration/stuck `app-loading-screen` issue
   - re-run the tab-switch timing benchmark to get web p50/p95
2. **Replace RN placeholders with real cached reads**
   - seed local DB during dev only (no network)
   - measure tab-switch timings under “real” cached datasets
3. **Run both environments with the same offline/online simulation**
   - p50 + p95 “press → first render”

If you want, I can turn the “next actions” into a new timeboxed milestone plan with explicit acceptance gates.

