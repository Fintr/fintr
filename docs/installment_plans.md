# Installment plans (transaction series)

This document is the **implemented** installment contract for Fintr. It is for contributors and AI assistants. If code and this file disagree, fix the code or update this file in the same change.

Transaction installments are a **flat split of a fixed total**. They are **not** loans. Loans use interest, PMT, and amortization — see [loan payment schedule design](./superpowers/specs/2026-08-17-loan-payment-schedule-design.md).

Historical design notes (some of which are stale): [installment plan revision design](./superpowers/specs/2026-08-18-installment-plan-revision-design.md). Prefer **this file** for current behavior.

---

## Contract

Every installment **series** has three linked values on the **root parent**:

| Field | Meaning | Storage |
|-------|---------|---------|
| **Total** | Full obligation for the plan | `installment_total_cents` (`installment_total` as Money) |
| **Term** | Number of monthly payments | `installment_period` (always months; UI may show years) |
| **Per payment** | Amount on each occurrence | `amount` / `amount_cents` on each row |

Create is **total-first**:

```text
per_payment = round_half_up(total ÷ term, 2)
installment_total_cents = round(total × 100)
```

Plan math later uses the **root parent’s** `installment_total_cents` and `installment_period`, not a re-sum of edited child amounts (except **this payment only**, which nudges the stored total by the delta of that one row).

Children copy `installment_period` and `installment_total_cents` for display. Series identity is `parent_id` / `root_parent` plus `records_in_series_tree` for leftover grandchildren.

---

## Recorded vs remaining

A payment is **recorded** (committed) when `balance_state` is `calculated` — typically the occurrence date is on or before today. Future rows stay `pending`.

- **This and future** freezes months **before** the edited payment’s date (including recorded ones) and redistributes the remaining total across the remaining term.
- **All payments in the plan** (`all_in_series`) revises **every** occurrence from the series start date, **including recorded months**. That option stays available after payments are recorded. Do not disable it and do not coerce it to `this_and_future`.

---

## Edit scopes

Users pick scope **before** the form math changes (`InstallmentUpdateScopeSelector`).

| Scope | `update_scope` | What changes |
|-------|----------------|--------------|
| This installment payment only | `this_only` | That row’s date/amount. Plan total **moves by the difference**. Other months stay as they are. |
| This and future payments | `this_and_future` | From the edited payment onward. Earlier months stay as recorded. |
| All payments in the plan | `all_in_series` | Whole series, including recorded months. Effective date is the **root** date. |

`this_only` does **not** run `ReviseInstallmentPlan`. It runs `sync_installment_total_for_this_only`, which applies `apply_this_only_amount_delta_cents`.

Plan revisions (`this_and_future` / `all_in_series`) require `installment_revision_anchor`:

| Anchor | Meaning |
|--------|---------|
| `total` | Keep (or use stored) plan total; recompute per-payment |
| `monthly` | Keep the submitted monthly amount; plan total becomes locked months + monthly × remaining count |
| `explicit` | User typed a new total; same split math as `total` with that total |

The expense edit form uses `explicit` when the user changes **Total amount**.

### Revision math (shared)

Implemented in both:

- `@fintr/domain` → `packages/fintr-domain/src/installment-plan.ts` (`computeInstallmentPlanRevision`)
- Ruby → `apps/fintr-be/app/utils/utils/installment_plan.rb` (`Utils::InstallmentPlan.compute_revision`)

```text
remaining_dates = occurrence dates from effective_date through term end
frozen_dates    = occurrence dates before effective_date
locked_cents    = sum of actual amounts on frozen dates (not “prior rate × count”)
remaining_total = installment_total − locked
per_payment     = round_half_up(remaining_total ÷ remaining_count, 2)
```

For `all_in_series`, `effective_date` is the **parent/root date**, so `frozen_dates` is empty and every month gets the new even split.

For `this_and_future`, `effective_date` is the **edited row’s date**.

Do not treat “paid so far” as “recorded months × original monthly” when a this-only bump already changed an earlier month. Frozen months must use **actual occurrence amounts**.

---

## Create

`Transactions::Operations::CreateTransaction#adjust_amount`:

1. User `amount` is the **plan total**.
2. Store `installment_total_cents` from that total.
3. Replace `amount` with `total ÷ installment_period` (half-up, 2 decimals).
4. If there is FX, scale conversion metadata to **per-payment** original and converted amounts (`scale_installment_conversion_to_per_payment`).
5. Materialize the rest of the term (`CreateRepeatTransactions` / `MaterializeSeriesChildren`).

Frontend create preview uses `roundInstallmentPerPayment` in `apps/fintr-fe/src/utils/installmentFormAmounts.ts`.

---

## Update (server)

`Transactions::Operations::UpdateTransaction`:

1. `this_only` + amount change → bump series `installment_total_cents` by the delta.
2. `this_and_future` or `all_in_series` **and** `installment_period` or `amount_cents` changed → `ReviseInstallmentPlan`.
3. Plan revision is **skipped** if neither period nor the edited row’s `amount_cents` changed. Sending a new total without a per-payment change on the opened row will not revise. Local-first preview still rewrites siblings; the API payload must include the new per-payment (or a period change) so the server applies the same plan.

`ReviseInstallmentPlan`:

- Converts an `explicit` `installment_total` into ledger cents with the root currency.
- Writes `installment_total_cents` on the root and remaining rows.
- `update_all`s remaining tree rows (`records_in_series_tree`) from `effective_date` to the new per-payment.

`all_in_series` is **allowed when recorded payments exist**. Recorded rows are rewritten to the new per-payment.

---

## Update (local-first)

Offline / IndexedDB preview must match the shared math:

| Piece | Path |
|-------|------|
| Apply plan revision to IndexedDB | `apps/fintr-fe/src/services/transactions/apply-installment-revision-local.ts` |
| Called from | `apps/fintr-fe/src/services/transactions/update-local-first.ts` |
| FX / ledger conversion | `apps/fintr-fe/src/utils/installmentRevisionLedger.ts` |
| Form preview | `apps/fintr-fe/src/utils/installmentFormAmounts.ts`, `apps/fintr-fe/src/utils/installmentPlanRevision.ts` |
| Scope UI | `apps/fintr-fe/src/components/dashboard/forms/InstallmentUpdateScopeSelector.tsx` |

Local-first still snapshots the series and restores it if the server returns a non-network error.

Do **not** upsert the opened row with the raw form amount **before** plan revision. That would leave a leftover balloon (e.g. £300) on the opened id while siblings move to the new even split.

---

## Multi-currency

Space/account **ledger** amounts are usually PHP (or the space currency). The user may type the plan in GBP (or another original currency) with a stored rate.

Rules:

- Plan total in original currency converts **once** into ledger cents (`toLedgerCents` / `Utils::InstallmentPlan.to_ledger_cents`): `ledger = original × rate`.
- Per-payment **booked** amount is ledger ÷ rate when original ≠ ledger. Do not divide an already-ledger total by the rate again (that produced £1.25 from a £3,000 plan at rate 100).
- If submit omits `exchange_rate`, use the **stored** conversion on the series.
- `amountCurrency` on a leftover balloon row may be GBP even when the space is PHP. Ledger math still uses the conversion’s converted currency, not that leftover’s `amountCurrency`.

Example at **100 PHP per 1 GBP**, 24 months, apply-all to **GBP 3,000**:

```text
ledger total     = 3000 × 100 = ₱300,000
per payment      = ₱12,500
booked per month = £125
```

Every occurrence, including the last month, should show **₱12,500 / £125**, not a leftover **£300** balloon.

---

## Leftover FX balloons

Installment FX edits can leave **two rows on the same date**: a converted occurrence (PHP ledger) and a leftover booked-currency balloon (e.g. £300).

On plan revision, `leftoverRowsOnRemainingDates`:

- Groups remaining dates that have more than one matching installment row.
- **Keeps** the row the user opened (`target.id`) if it is on that date; otherwise prefers the space-currency occurrence.
- **Deletes** the other id from IndexedDB **and** React Query caches.

A leftover that is the **only** row on its date is not deleted; it is rewritten to the new per-payment.

Series collection walks `parent_id` / `rootParentId` **and** leftover children parented to a later payment, not only shallow `parent_id = root`.

---

## What not to do

- Do not block or coerce `all_in_series` after recorded payments. Flexibility is intentional.
- Do not implement installment division in a controller. Create, update, and revise go through operations.
- Do not treat leftover GBP `amount` as already-ledger PHP.
- Do not use Faker in specs.
- Do not silently change recorded history on **this and future**. That is what **all payments in the plan** is for.

---

## Code map

| Layer | Location |
|-------|----------|
| Shared math | `packages/fintr-domain/src/installment-plan.ts` |
| Shared tests | `packages/fintr-domain/src/installment-plan.test.ts` |
| Ruby math | `apps/fintr-be/app/utils/utils/installment_plan.rb` |
| Create split | `Transactions::Operations::CreateTransaction#adjust_amount` |
| This-only total | `UpdateTransaction#sync_installment_total_for_this_only` |
| Plan revise | `Transactions::Operations::ReviseInstallmentPlan` |
| Materialize children | `Transactions::Operations::MaterializeSeriesChildren` |
| Local revise | `apply-installment-revision-local.ts` |
| Local update orchestration | `update-local-first.ts` |
