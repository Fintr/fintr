# Activity Model Migration Plan

## Overview

This document describes the migration from **Scenic SQL views** (`combined_transactions`, `account_activities`) to a physical **`activities` table** using Rails [`delegated_type`](https://learn.railsfullstack.com/lessons/senior-ocp-delegated-type).

**Goal:** One canonical parent record per cash event — an **Activity** — with type-specific behavior living in delegate models (`Income`, `Expense`, `Transfer`, `Loan`, `LoanPayment`). Feeds, insights, budgets, and reconciliation all read from the same source of truth instead of UNION views that can drift from write paths.

**Status:** Planned. Not started. The interim solution (views + unified serializers) is in place and is the baseline this plan replaces.

---

## Problem Statement

Today, “money that moved” is split across four write tables and two read views:

| Write table | What it represents |
|-------------|-------------------|
| `transactions` (STI: Income / Expense) | Cash in or out on one account |
| `transfers` | Cash moved between two accounts |
| `loans` | Loan disbursement (when `adjusts_account_balance`) |
| `loan_payments` | Loan repayment (when `adjusts_account_balance`) |

| Read view | What it unions |
|-----------|----------------|
| `combined_transactions` (v3) | Space-level chronological list (one row per transfer) |
| `account_activities` (v2) | Account-scoped list (two rows per transfer: `:in` / `:out`) |

**Pain points the view approach does not solve long term:**

1. **No single parent row** — polymorphism exists only in SQL, not in ActiveRecord. Preloading, embeddings, versioning, and imports must special-case each type.
2. **Sync risk** — any new write path (import, admin fix, background job) must be reflected in view logic; there is no enforced link at the DB layer.
3. **Naming confusion** — `Transactions::AccountActivity` is a readonly view model, not the target `Activity` parent. `Transactions::Combined` is another view wrapper.
4. **Transfer account perspective** — account feeds duplicate transfer rows in SQL (`:in` / `:out` composite ids). A physical model must encode this explicitly.

**Already completed (prerequisites):**

- Loan interest **shadow transactions** removed; interest for budgets reads `loan_payments.interest_payment_cents`.
- `combined_transactions` v3 and `account_activities` v2 include loans and loan payments.
- Version tables: `transfer_versions`, `loan_versions`, `loan_payment_versions`.
- FE types: `loan_disbursement`, `loan_payment` in `CombinedTransactionTypeEnum`.

---

## Target Architecture

### Parent model: `Transactions::Activity`

```ruby
module Transactions
  class Activity < ApplicationRecord
    delegated_type :activitable, types: ACTIVITABLE_TYPES, dependent: :destroy

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :account, class_name: "Transactions::Account", optional: true

    # Shared columns used for list/filter/sort across all kinds
    # date, amount_cents, amount_currency, description, balance_state, activity_kind, ...
  end
end
```

### Delegate types (`activitable`)

| Delegate | Table | `activity_kind` (API) | Notes |
|----------|-------|----------------------|-------|
| `Transactions::Income` | `transactions` | `income` | STI row; category + running balance |
| `Transactions::Expense` | `transactions` | `expense` | STI row; category + running balance |
| `Transactions::Transfer` | `transfers` | `transfer` | Two accounts; optional fee transactions |
| `Transactions::Loan` | `loans` | `loan_disbursement` | Only when `adjusts_account_balance` |
| `Transactions::LoanPayment` | `loan_payments` | `loan_payment` | Only when `adjusts_account_balance` |

**Out of scope for Activity delegates:**

- `Transactions::Draft` — not cash movement; stays out of Activity.
- Loan interest as synthetic `transactions` rows — **removed**; do not reintroduce.
- Tracking-only loans / payments (`adjusts_account_balance: false`) — no Activity row (matches current view `WHERE` clauses).

### Design principles

1. **Delegate tables stay authoritative for domain rules** — amortization, repeat series, currency conversion, file attachments, and balance math remain on `Transfer`, `Loan`, etc. Activity holds the **shared list/reconciliation shape** and the polymorphic pointer.
2. **Create/update/delete always touch Activity** — via an `Activitable` concern on each delegate, invoked from existing operations (not ad hoc in controllers).
3. **One Activity per space-level cash event** — mirrors `combined_transactions` (one row per transfer). Account-scoped feeds are derived (see Phase 3).
4. **Do not collapse Loan into Transaction** — loans keep their own lifecycle; Activity unifies the *read* model only.

### Amount model (locked)

Every cash event carries **two amount concepts**:

| Column | Where it lives | Meaning |
|--------|----------------|---------|
| **`amount`** | Delegate row (and denormalized on `activities` for list/export) | The **booked / native amount** on the underlying record. For **income and expense**, this may be **positive or negative** (user-entered sign is preserved). For transfers, loans, and loan payments, this is typically the principal/transfer/payment magnitude in the delegate’s currency (usually positive). |
| **`activity_amount`** | `activities` table (canonical for feeds, CSV, reconciliation) | The **signed cash impact**: **positive (+) if money is added** to the relevant account context, **negative (−) if money is removed**. This is what list totals, account feeds, and exports use for “did balance go up or down?” |

**Signing rules for `activity_amount`** (from the Activity’s primary `account_id` perspective, or space-level rules for transfers):

| `activity_kind` | `activity_amount` sign |
|-----------------|------------------------|
| `income` | `+` (money in). If delegate `amount` is negative, normalize per product rules in `SyncFromActivitable` (see below). |
| `expense` | `−` (money out). If delegate `amount` is negative, normalize per product rules. |
| `transfer` | Account feed: `+` on to-account row, `−` on from-account row. Space-level export: include both account columns; `activity_amount` may be omitted or duplicated per export row convention (see CSV section). |
| `loan_disbursement` | `+` when `loan_type = borrowed` (cash in); `−` when `loan_type = lent` (cash out). |
| `loan_payment` | `−` when `loan_type = borrowed` (repayment out); `+` when `loan_type = lent` (repayment in). |

**Income / expense sign normalization** (delegate `amount` → `activity_amount`):

- Store delegate `amount_cents` **as entered** (may be negative).
- Derive `activity_amount_cents` in `SyncFromActivitable`:
  - **Income:** `activity_amount_cents = amount_cents.abs` if `amount_cents >= 0`, else `−amount_cents.abs` (or equivalent: income always presents as “money in” with sign reflecting reversal/refund semantics).
  - **Expense:** `activity_amount_cents = −amount_cents.abs` if `amount_cents >= 0`, else `+amount_cents.abs` (expense always presents as “money out”; negative expense = refund/inflow).
- Exact rules to be finalized in Phase 0 with one table of examples; **feeds and CSV always expose `activity_amount`**, not raw delegate sign alone.

**API / serializers:** expose both when useful:

- `amount` / `amountCurrency` — booked/native (delegate)
- `activityAmount` / `activityAmountCurrency` — signed resulting amount (from Activity)

List coloring and daily net on account feeds use **`activity_amount`**, not delegate `amount` alone.

---

## `activities` Table (draft schema)

High-level columns; exact nullability to be finalized in implementation.

```ruby
create_table :activities, id: :uuid do |t|
  t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
  t.references :account, foreign_key: { to_table: :accounts }, type: :uuid
  # Primary account for income/expense/loan/payment; null for space-level transfer rows

  t.string :activitable_type, null: false
  t.uuid :activitable_id, null: false

  t.string :activity_kind, null: false
  # income | expense | transfer | loan_disbursement | loan_payment

  t.datetime :date, null: false

  # Booked/native amount (denormalized from delegate; may be negative for income/expense)
  t.bigint :amount_cents, null: false
  t.string :amount_currency, null: false

  # Signed resulting cash impact (+ in, − out) — canonical for feeds, export, reconciliation
  t.bigint :activity_amount_cents, null: false
  t.string :activity_amount_currency, null: false

  t.text :description

  t.string :balance_state
  t.bigint :balance_cents
  t.string :balance_currency

  # Denormalized display fields (optional — can stay on serializer via delegate)
  t.string :category_name
  t.uuid :category_id
  t.string :from_account_name
  t.string :to_account_name
  t.uuid :loan_id
  t.string :entity_name
  t.string :loan_type

  t.timestamps

  t.index [:space_id, :date, :created_at]
  t.index [:account_id, :date, :created_at]
  t.index [:activitable_type, :activitable_id], unique: true
  t.index [:space_id, :activity_kind]
end
```

**Open design decision — account-scoped transfers:**

`account_activities` currently emits **two rows** per transfer (from-account and to-account perspectives). Options:

| Option | Pros | Cons |
|--------|------|------|
| **A. `activity_account_perspectives` join table** | Normalized; one Activity per transfer | Extra join on account feed queries |
| **B. Two Activity rows per transfer** | Simple account queries | Duplicated parent rows; harder uniqueness |
| **C. Query-time expansion in `FilteredAccountActivities`** | Single Activity row | Logic in query layer (closer to today’s view) |

**Recommendation:** Option **C** for Phase 3 parity, then evaluate Option **A** if query complexity hurts. Document the chosen option before Phase 3 ships.

---

## CSV export changes

**Current state** (`Transactions::Operations::Reports::DownloadCsv`):

- Input: `FilteredCombined` result (`Transactions::Combined` rows from `combined_transactions` view **v3**).
- **Row set today:** income, expense, transfer, **loan disbursement**, and **loan payment** — `combined_transactions` v3 unions `loans` and `loan_payments` (when `adjusts_account_balance`), and `Combined::TYPE_MAPPING` maps them to `loan_disbursement` / `loan_payment` in the export.
- Columns: Transactable Type, Transactable ID, Date, **Amount** (unsigned magnitude from the view), Amount Currency, Description, To/From Account, Category, Transaction Cost, Balance State.
- **Gaps (what Activity migration still changes):**
  - No **`activity_amount`** column (signed +/− cash impact).
  - No loan metadata columns in CSV (`loan_id`, `entity_name`, `loan_type`) even though rows are present.
  - **Amount** is always exported as unsigned; income/expense delegate sign is not represented.
  - Contract is tied to `Transactions::Combined`; export logic lives on the view read model, not `Activity`.

**Target state (Activity-backed):**

| Change | Detail |
|--------|--------|
| **Data source** | `FilteredActivities` instead of `FilteredCombined` / `Combined` (same filters as transactions index). |
| **Operation** | Refactor `DownloadCsv` → accept `activities:` param; drop `Combined`-only contract. |
| **Row set** | **Parity with today:** one row per space-level cash event — income, expense, transfer, loan disbursement, loan payment. No regression vs current combined export. |
| **Column: `activity_kind`** | Replaces “Transactable Type” (`income`, `expense`, `transfer`, `loan_disbursement`, `loan_payment`). |
| **Column: `amount`** | Booked/native amount from delegate (may be negative for income/expense). |
| **Column: `activity_amount`** | **Signed resulting amount** (+ adds money, − removes money) per Amount model above. Primary column for reconciliation and spreadsheet sums. |
| **Column: `activity_amount_currency`** | Currency for `activity_amount` (space or account leg per existing display rules). |
| **Loans** | Rows already exported today; **add** `loan_id`, `entity_name`, `loan_type` columns for spreadsheet usefulness (parity with API). |
| **Transfers** | Keep `to_account_name`, `from_account_name`; `activity_amount` on space-level row can be **positive magnitude** with direction implied by accounts, **or** export two rows per transfer (from/to) when exporting account-scoped CSV — document choice in Phase 0. |
| **Controller** | `GET /api/v1/transactions/generate_csv` — swap query to Activity; response filename may become `activities_YYYY-MM-DD.csv` (or keep `transactions_` for backward compatibility). |
| **FE** | `generateTransactionsCsv` in `queries.tsx` — no param changes if API contract stays; optional copy update for new `activity_amount` column. |

**Proposed CSV headers (v2):**

```text
activity_kind, activitable_id, date, amount, amount_currency, activity_amount, activity_amount_currency,
description, to_account_name, from_account_name, category_name, loan_id, entity_name, loan_type,
transaction_cost, transaction_cost_currency, balance_state
```

**Phase assignment:** implement in **Phase 3** (read path) alongside list API; add request spec comparing `activity_amount` signs to fixture loans/transfers/income/expense.

**Success criteria:**

- Export row count and kinds match pre-migration combined export for the same filters (including loans and loan payments).
- New `activity_amount` column signs are correct for income, expense, transfer, loan disbursement, and loan payment.
- Income/expense rows with negative delegate `amount` produce correct signed `activity_amount`.

---

## Import process changes

**Current state** (see `docs/import_feature_planning.md`):

- Import creates **`Transactions::Income` / `Transactions::Expense` only** via `CreateTransaction` / `BulkImportTransactions`.
- Template columns: `date`, `description`, `amount`, `type`, `category`.
- Validation: **`amount` must be positive** (`gt?: 0`) in `ImportSingleRecord`, `ValidateAndPrepareRows`, `BulkImportTransactions`.
- All imports go to default **“Import”** account; `balance_state: pending` skips balance calculation.
- **`import_records.record_type`** is `Transactions::Transaction` (or null on failure).
- **No Activity row** today; no loan/transfer import.

**Target state (Activity-aware):**

| Change | Detail |
|--------|--------|
| **Every successful import creates Activity** | After delegate persist, `step sync_activity` (same as Phase 2). Bulk import must batch-sync or call `SyncFromActivitable` per row in the same transaction as insert. |
| **`amount` column (template)** | **Allow positive or negative** numbers for income/expense. Remove `gt?: 0` validation; reject `amount == 0` only. Sign + `type` together define intent; `activity_amount` computed on sync. |
| **`activity_amount`** | Not imported directly — **derived** on `SyncFromActivitable` from delegate `amount`, `type`, and account context. |
| **`import_records`** | Extend `record_type` to allow `Transactions::Activity` as optional pointer **or** keep pointing at delegate (`Transactions::Transaction`) with Activity created via sync (preferred: record delegate; Activity reachable via `activitable`). |
| **Revert import** | `RevertImport` must destroy delegate **and** synced Activity (dependent destroy on `activitable` or explicit delete). |
| **Bulk path** | `BulkImportTransactions` today uses `bulk_import` + separate balance/version steps — add **`Activities::BulkSync`** or per-row sync in operation; verify `activities:verify_backfill` after bulk import in specs. |
| **Template v2 (optional milestone)** | Add columns for future kinds: `activity_kind` (default `income`/`expense` from `type`), optional `account_name` (today still default Import account unless product opens this). Loans/transfers via import **out of scope** for initial Activity migration; document as Phase 6+ if needed. |
| **Validation docs** | Update `import_feature_planning.md` when implemented: `amount` may be negative; document examples (refund = negative expense or positive income per conventions). |

**Import amount examples (to document in Phase 0):**

| type | amount (CSV) | Delegate `amount` stored | `activity_amount` |
|------|----------------|---------------------------|---------------------|
| expense | `500` | +500 (or 500 as entered) | −500 |
| expense | `−500` | −500 | +500 (refund / reversal) |
| income | `1000` | +1000 | +1000 |
| income | `−1000` | −1000 | −1000 (reversal) |

**Phase assignment:**

- **Phase 2:** wire `CreateTransaction` / bulk import to `SyncFromActivitable`; relax amount validation in import operations.
- **Phase 3+:** CSV export parity.
- **Phase 6 (optional):** import template v2 with `activity_kind` and non-transaction delegates.

**Success criteria:**

- Imported income/expense appears in Activity-backed list and account feed with correct `activity_amount` sign.
- Revert removes Activity and delegate.
- Sample template and `GenerateSampleTemplate` reflect signed `amount` rules.

---

## Migration Phases

### Phase 0 — Design lock & parity checklist

**Deliverables:**

- [ ] Confirm delegate list and `activity_kind` values match API/FE enums.
- [ ] Confirm account-scoped transfer strategy (see table above).
- [ ] **Amount model:** lock income/expense sign → `activity_amount` examples table; confirm API field names (`amount` vs `activityAmount`).
- [ ] **CSV export:** confirm space-level vs account-scoped transfer rows and header list (see CSV section).
- [ ] **Import:** confirm relaxed `amount` validation and template copy (see Import section).
- [ ] Parity checklist: every column/behavior in `combined_transactions_v03.sql` and `account_activities_v02.sql` mapped to Activity or delegate.
- [ ] Rollback strategy: keep views until Phase 5 verification passes.

**No production schema changes.**

---

### Phase 1 — `activities` table + model + backfill

**Backend:**

1. Migration: create `activities` with indexes and unique `[activitable_type, activitable_id]`.
2. Model: `Transactions::Activity` with `delegated_type :activitable`.
3. Backfill migration (idempotent): insert one Activity per existing delegate row using the same rules as the v2/v3 views (including exclusions for loan-linked shadow txs — should be zero after cleanup).
4. Rake task: `activities:verify_backfill` — compare row counts and spot-check amounts vs views.

**Success criteria:**

- Row count matches `combined_transactions` (non-draft) for each `activity_kind`.
- No orphan delegates without Activity; no duplicate activitable keys.

---

### Phase 2 — Write-path sync (`Activitable` concern)

**Backend:**

1. Concern: `Transactions::Concerns::Activitable` on `Income`, `Expense`, `Transfer`, `Loan`, `LoanPayment`.
2. Hooks: after_create / after_update / after_destroy (or explicit calls from operations — **prefer operation-level `step sync_activity` for transaction safety**).
3. Operation: `Transactions::Operations::Activities::SyncFromActivitable` — builds/updates Activity from delegate state.
4. Wire into existing create/update/delete operations:
   - `CreateTransaction`, `UpdateTransaction`, `DeleteThisTransaction`
   - Transfer operations
   - Loan / loan payment operations
5. Imports and any other bulk write paths audited and wired (see **Import process changes**).

**Success criteria:**

- New records get an Activity in the same DB transaction as the delegate.
- Specs: each operation creates/updates/destroys Activity.
- `activities:verify_backfill` still passes after CRUD in test DB.

---

### Phase 3 — Read path: queries & API

**Backend:**

1. `Transactions::Queries::FilteredActivities` — replaces `FilteredCombined` for space-level lists.
2. `Transactions::Queries::FilteredAccountActivities` — reads from `Activity` (+ transfer perspective logic per Phase 0 decision).
3. Serializers: `FilteredActivitySerializer` (or evolve `FilteredCombinedSerializer` to read Activity).
4. Controllers:
   - `GET /api/v1/transactions` → Activity-backed (keep response shape stable for FE).
   - `GET /api/v1/transactions/accounts/:id/activities` → Activity-backed.
5. Insights / totals (`TotalsByType`, expense breakdown) — switch relation from `Combined` to `Activity`; use **`activity_amount`** for signed nets where appropriate.
6. Preload module: replace `PreloadsCombinedTransactableAssociations` with `PreloadsActivityAssociations`.
7. **CSV export** — refactor `DownloadCsv` to Activity input; add `activity_amount` column (see CSV section).

**Success criteria:**

- Request specs pass with same JSON shape (camelCase via existing `ApiResponses`).
- Performance within acceptable range vs view (index on `[space_id, date, created_at]`).

---

### Phase 4 — Frontend consolidation

**Frontend:**

1. Introduce `Activity` / `IndexActivity` type aligned with API (can alias `IndexTransaction` initially).
2. Transactions tab and account detail use one hook/service where possible.
3. Remove assumptions tied to view-only ids (e.g. `activitableId` vs composite `id` for transfers).
4. Update `activityDisplay.ts` to use `activity_kind` consistently.

**Success criteria:**

- Account detail and transactions tab behave identically to pre-migration.
- Loan rows still route to Loans tab; edit/delete guards unchanged.

---

### Phase 5 — Retire views & rename models

**Backend:**

1. Drop Scenic views: `combined_transactions`, `account_activities`.
2. Remove readonly models: `Transactions::Combined`, view-backed `Transactions::AccountActivity` (name freed for delegate parent if desired — **use `Activity` as the parent name**).
3. Cleanup:
   - Remove `loan_payments.transaction_id` if still unused (legacy shadow link).
   - Dead code in serializers (`has_loan_payment` always false).
4. Update factories and specs to build `Activity` where appropriate.

**Success criteria:**

- No references to `combined_transactions` or `account_activities` views in app code.
- Full BE spec suite green.

---

### Phase 6 — Optional enhancements (post-cutover)

Not required for initial migration; track separately:

- PaperTrail on `activities` (or rely on delegate version tables).
- RAG embeddings on `Activity` instead of per-delegate `embeddable`.
- Budget / monthly report top-level totals unified through Activity.
- Single FE route naming: “Activity” everywhere instead of “Transactions” for the combined feed.

---

## What Stays the Same

| Area | Unchanged |
|------|-----------|
| **Delegate tables** | `transactions`, `transfers`, `loans`, `loan_payments` keep their schemas (minus legacy cleanup). |
| **STI** | `Income` / `Expense` remain STI under `Transaction`. |
| **Loan domain** | Loans tab, amortization, entities, payment schedules — not absorbed into Transaction. |
| **Balance calculation** | Still driven by delegate models and existing balance operations. |
| **Budget interest** | Still from `loan_payments.interest_payment_cents`, not Activity rows. |
| **API routes** | Prefer stable URLs; change implementation behind existing endpoints first. |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Activity / delegate drift | Unique index on activitable; sync in same transaction; verification rake in CI |
| Missed write path (import, job) | Audit grep for `.create!` / direct SQL on delegate tables; checklist in Phase 2 |
| Account transfer double-row regression | Explicit spec matrix for from/to account; compare to `account_activities_v02` |
| Performance regression | Composite indexes; benchmark `FilteredActivities` vs view on large space |
| Long migration PR | Ship Phases 1–2 behind feature flag or with views still primary until Phase 3 cutover |

---

## Testing Strategy

1. **Backfill verification rake** — counts and sample hashes per space.
2. **Parity specs** — for a fixture space, Activity query results match exported view results field-for-field.
3. **Operation specs** — every create/update/delete path asserts Activity sync.
4. **Request specs** — transactions index + account activities unchanged JSON.
5. **FE** — `activityDisplay.test.ts`, account detail integration tests.

---

## Rollout

1. Deploy Phase 1–2 (table + backfill + sync) with views still serving reads.
2. Run `activities:verify_backfill` on staging/production after backfill.
3. Deploy Phase 3 (flip read path) in a single release or behind `ENV["ACTIVITIES_READ_ENABLED"]`.
4. Monitor Sentry and slow-query logs for list endpoints.
5. Deploy Phase 5 (drop views) only after Phase 3–4 stable for one release cycle.

---

## File Touch Map (reference)

| Area | Current | Target |
|------|---------|--------|
| Read model | `app/models/transactions/combined.rb` | `app/models/transactions/activity.rb` |
| Account read model | `app/models/transactions/account_activity.rb` (view) | Query layer on `Activity` |
| Views | `db/views/combined_transactions_v03.sql`, `account_activities_v02.sql` | Dropped |
| Queries | `filtered_combined.rb`, `filtered_account_activities.rb` | `filtered_activities.rb` |
| Serializers | `filtered_combined_serializer.rb`, `filtered_account_activity_serializer.rb` | Activity-backed; expose `amount` + `activityAmount` |
| CSV export | `reports/download_csv.rb` (Combined input) | Activity input; `activity_amount` column |
| Import | `imports/operations/*` (Transaction only, amount > 0) | Sync Activity; signed `amount` allowed |
| FE types | `transactionTypes.ts` (`IndexTransaction`) | `IndexActivity` (or unified alias) |

---

## Related Documents

- `docs/import_feature_planning.md` — import paths must call Activity sync (Phase 2 audit).
- `apps/fintr-be/docs/currency_system.md` — amount display in space currency unchanged.
- Rails delegated type reference: [OCP 5 — delegated_type in Real Rails Code](https://learn.railsfullstack.com/lessons/senior-ocp-delegated-type)

---

## Decision Log

| Date | Decision |
|------|----------|
| 2026-06 (interim) | Ship unified **Scenic views** first to unblock account activity feeds without sync layer. |
| 2026-06 | Remove loan interest shadow `transactions`; budgets use `loan_payments.interest_payment_cents`. |
| 2026-06 (planned) | **`Activity` is the delegated_type parent**; delegate tables remain source of domain truth. |
| 2026-06 (planned) | **Two amount columns:** delegate `amount` (may be ± for income/expense); Activity `activity_amount` signed (+ in / − out). |
| 2026-06 (planned) | **CSV export** moves to Activity rows; add `activity_amount` column. **Import** syncs Activity; allow signed `amount` on income/expense. |
| TBD | Account-scoped transfer representation (Option A/B/C above). |
| TBD | Income/expense negative-amount examples finalized in `SyncFromActivitable`. |
