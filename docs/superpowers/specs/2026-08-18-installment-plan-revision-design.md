# Installment plan revision (contract, term, and amount changes)

> **Implemented behavior lives in [docs/installment_plans.md](../../installment_plans.md).** This file is the original design discussion. Where it conflicts (especially “all in series only before payments are recorded”), follow the implemented doc.

## Goal

Installments are a **payment plan**, not a generic recurring expense. Users enter a **total obligation** and a **term**; Fintr derives the **per-payment amount**. When someone edits the plan later, they must choose **what stays fixed** (total vs monthly payment) and see a **preview** of the outcome before anything is applied.

This document defines:

- The **installment contract** (stored fields and derived values)
- **Create** behavior (unchanged intent, explicit storage)
- **Edit scopes** (this occurrence vs plan-level changes)
- **Revision options** when **term**, **amount**, or **both** change
- **Backend rules** (what rows may change; ledger safety)
- **Phased delivery** (v1 → v3)

Related but separate: **loans** use amortization, interest, and PMT logic — see [loan payment schedule design](./2026-08-17-loan-payment-schedule-design.md). **Transaction installments** are flat splits of a fixed total with no interest engine.

---

## Problem today

| Area | Current behavior | Gap |
|------|------------------|-----|
| **Create** | User enters total + term; backend divides `amount ÷ installment_period` per row | Total is not stored explicitly on the series parent |
| **Term change** | Schedule regenerates (`this_and_future`); per-payment amount often **unchanged** | Extending 12 → 14 months keeps ₱100/mo → implied total becomes ₱1,400 instead of redistributing ₱1,200 |
| **Amount change** | Can update amount with scope modal | No “keep total vs keep monthly” choice; unclear if one month or whole plan changes |
| **Combined edits** | Single form, no anchor | No way to resolve conflicting total / term / monthly inputs |
| **Child rows** | Children duplicate parent fields inconsistently in UI | Detail/edit may show `0 months` until parent is resolved |

Users reasonably expect: **₱1,200 over 12 months → extend to 14 months → ~₱85.71/month** if the **total stays the same**.

---

## Installment contract

Every installment **series** (root parent) has a contract with three linked values:

| Field | Meaning | Example |
|-------|---------|---------|
| **Total** | Full price / obligation for the plan | ₱1,200 |
| **Term** | Number of monthly payments (`installment_period`, always in months) | 12 |
| **Per payment** | Amount on each occurrence (`amount` on each row) | ₱100 |

**Invariant at create (total-first):**

```
per_payment = round(total ÷ term, 2)
```

**New persisted field (parent only):**

- `installment_total_cents` (or `installment_total` as Money) — set once at create as `per_payment × term` (or the user-entered total before division). This is the **anchor** for plan revisions; do not re-derive from edited per-payment amounts after partial payments.

Optional metadata for audit:

- `installment_term_months` — same as `installment_period` on parent (single source of truth: prefer `installment_period` unless we rename later)
- `installment_anchor` — last revision strategy: `total` | `monthly` | `explicit` (for support/debug only in v1)

Children keep `installment_period` and `installment_count` for display and queries; **plan math uses the root parent’s contract**.

---

## Create (no UX change to entry model)

**User enters:** total amount + installment term (months or years in UI → months in API).

**System:**

1. Store `installment_total` on parent = entered total (before split).
2. Store `installment_period` = term in months.
3. Store each row’s `amount` = `installment_total ÷ installment_period` (half-up, 2 decimals).
4. Materialize **all** occurrences through term end (see installment materialization work).

**Display:** Series detail shows “12 months · ₱100/month · ₱1,200 total” (or equivalent).

---

## Edit scopes (existing pattern, installment-specific copy)

Before any plan math, user chooses **where** the edit applies (`ScopeModal` / `update_scope`):

| Scope | Use when | Effect on contract |
|-------|----------|-------------------|
| **This occurrence only** | One-off correction, late fee, partial payment, wrong month | **Does not** change series contract; only this row |
| **This and future** | Renegotiated plan from this date | Recalculates **pending** (and new) rows; **past calculated rows unchanged** |
| **All in series** | Fix entire plan (rare) | Updates all rows; warn if any are **calculated** (money already moved) |

**Defaults:**

- Description / category / merchant → scope as today.
- Term or plan-level amount → default scope **This and future**.
- Single-month amount tweak without “revise plan” intent → **This occurrence only**.

Installments **cannot** change `schedule_type` to/from `repeat` or `one_time` (existing rules stand).

---

## When term changes — “How should we adjust?”

**Trigger:** `installment_period` or series **start cadence** changes, with scope **This and future** or **All in series**.

Show a dedicated step: **Revise installment plan** (not the generic scope modal alone).

### Option 1 — Keep total (recommended default)

**Label:** Keep total  
**Explanation:** “Spread the same overall price over the new number of months. Your monthly payment will go down if you add months, or up if you remove months.”

**Math (nothing paid yet):**

```
new_per_payment = installment_total ÷ new_term
```

**Example:** ₱1,200 · 12 → 14 months → **₱85.71/month**, total stays **₱1,200**.

**Math (some months already calculated):**

```
paid_so_far     = sum(amount) for rows where balance_state = calculated
remaining_total = installment_total − paid_so_far
remaining_count = count of occurrences from effective date through new term end
new_per_payment = remaining_total ÷ remaining_count
```

**Example:** 3 × ₱100 paid (₱300); total ₱1,200; extend to 14 months from start → 11 future months → **(₱900 ÷ 11) ≈ ₱81.82** for pending rows. Past 3 rows stay ₱100.

### Option 2 — Keep monthly payment

**Label:** Keep monthly payment  
**Explanation:** “Same amount each month. Adding months increases what you’ll pay in total; removing months lowers it.”

**Math:**

```
new_total_implied = paid_so_far + (per_payment × remaining_count)
```

**Example:** ₱100/mo · 12 → 14 months, none paid → total becomes **₱1,400**. Parent `installment_total` updates to match if user confirms.

### Option 3 — Set new total (explicit renegotiation)

**Label:** Set new total  
**Explanation:** “The overall price changed (e.g. seller adjusted the balance). We’ll recalculate monthly payments for the remaining months.”

User enters **new total**; system applies Option 1 math with that total as `installment_total`.

**v1:** Options 1 and 2 only. Option 3 in v2 if needed (can be folded into Option 1 with an editable total field).

---

## When only per-payment amount changes

**Trigger:** `amount` changes, term unchanged, scope is plan-level.

### This occurrence only (no plan modal)

**Label:** Only this payment  
**Explanation:** “Change just this month. The rest of the plan stays the same.”

- Updates one row.
- Does **not** change `installment_total` or other months.

### This and future — keep term, change monthly

**Label:** New monthly amount  
**Explanation:** “From this payment forward, every month will use the new amount. The overall total will update.”

```
paid_so_far      = sum(calculated amounts)
remaining_count  = pending occurrences from effective date
new_total        = paid_so_far + (new_monthly × remaining_count)
```

Update parent `installment_total` and all **pending** row amounts.

### This and future — keep total, change monthly (derived)

Rare; usually the same as “keep total” when term is fixed — monthly is `remaining_total ÷ remaining_count`. Expose only if user edits monthly but we infer they meant “fit the remaining balance.”

---

## When both term and amount change

Use **one** “Revise installment plan” flow — never two modals in sequence.

**Step 1 — Scope** (this only vs this and future).

**Step 2 — What did you change?** (informational; derived from form dirty fields)

**Step 3 — What should stay the same?** (required if plan-level)

| Anchor | User intent | System derives |
|--------|-------------|----------------|
| **Keep total** | “Still paying ₱1,200 overall” | `per_payment = f(total, term, paid_so_far)` |
| **Keep monthly** | “I can only pay ₱X per month” | `total = paid_so_far + (monthly × remaining_count)` |
| **Set both explicitly** (advanced) | Renegotiated deal | Validate; if total ≠ monthly × remaining, show conflict |

**Conflict example:** User enters 14 months, ₱100/mo, but total still shows ₱1,200.

> “₱100 × 14 = ₱1,400, which doesn’t match ₱1,200. Choose: keep total ₱1,200 (→ ₱85.71/mo) or keep ₱100/mo (→ ₱1,400 total).”

---

## Preview block (required before confirm)

Always show a read-only summary:

```
Installment plan changes

Total commitment:     ₱1,200.00  →  ₱1,200.00
Term:                 12 months   →  14 months
Per payment:          ₱100.00     →  ₱85.71

Already recorded:     3 payments (₱300.00) — will not change
Future payments:      11 × ₱81.82  (or 11 × ₱85.71 if none paid yet)

New implied total:    ₱1,200.00
```

Use space currency formatting. If **All in series** would rewrite calculated rows, show a **warning** and block or require extra confirmation.

---

## Backend rules

### Row mutability

| Row state | Term / plan amount change |
|-----------|---------------------------|
| `calculated` (on or before today) | **Do not** change `amount` or `date` in plan revision |
| `pending` (future) | May delete and recreate, or update amount in place |
| Parent (root) | Always update contract fields: `installment_total`, `installment_period`, `schedule` |

### Operation shape

Introduce a single operation (name TBD), e.g. `Transactions::Operations::ReviseInstallmentPlan`:

**Inputs:**

- `transaction_id` (any row in series; resolve root)
- `update_scope` — `this_only` | `this_and_future` | `all_in_series`
- `effective_date` — usually edited row’s date
- `anchor` — `total` | `monthly` | `explicit`
- `new_installment_period` (optional)
- `new_monthly_amount` (optional)
- `new_installment_total` (optional, for explicit anchor)

**Steps:**

1. Validate (contract exists, installment type, scope allowed, no calculated row rewrite unless `all_in_series` + explicit ack).
2. Load series; compute `paid_so_far`, `remaining_count`, new contract values from anchor.
3. Update parent (`installment_total`, `installment_period`, `amount` on parent if it is an occurrence).
4. Regenerate schedule (IceCube / `CreateSchedule`).
5. Delete pending children from effective date forward (existing `UpdateThisAndFutureTransactions` pattern).
6. `CreateRepeatTransactions` through new term end with new per-payment amount.
7. If scope is `this_only`, skip plan steps — delegate to normal `UpdateTransaction`.
8. Broadcast / monthly summaries / balance recalc as today.

Do **not** scatter division logic in `UpdateTransaction` without the anchor; `adjust_amount` remains **create-only**.

### Idempotency and offline

- FE preview uses the same formulas as BE (`@fintr/domain` schema + parity fixtures).
- Outbox payload includes `anchor` + revision params so replay matches preview.

---

## Frontend UX

### New components

1. **`InstallmentPlanRevisionModal`** — anchor radio group, explanations, preview, confirm.
2. Wire into **`EditTransactionDialog`** when installment + (`installmentPeriod` or plan-level `amount`) changed and scope ≠ this only.
3. **`ExpenseForm` / series detail** — show stored total on parent: “₱1,200 total · 12 months · ₱100/mo”.

### Copy guidelines

- Say **“total”** / **“monthly payment”** / **“months”** — not internal field names.
- Always state whether **past payments** change (default: **no**).
- Default anchor: **Keep total**.

### Entry term UI

- Installment term: months/years toggle (like loan term); API always **months** (`installment_period`).

---

## Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **v1** | `installment_total` on create; materialize full series; child inherits term in detail; **term change** modal (keep total \| keep monthly) + preview; **this and future** only for plan changes |
| **v2** | Plan-level **amount** change with same anchors; **this only** for single-month override; combined term + amount in one modal |
| **v2** | Explicit **new total** anchor; shorten-term warnings |
| **v3** | Partial payments, skip month, paid-ahead (if product needs them) |

**Out of scope (installment transactions):**

- Interest / amortization (use **Loans**).
- Recast-style “lower payment, same end date” without user choosing anchor.
- Silently changing calculated history.

---

## Open questions (resolve before v2)

1. **Rounding:** Remainder from `total ÷ term` — add to **last payment** (like loans) or distribute? Document choice in operation specs.
2. **All in series** on a plan with calculated rows — hard block vs “adjust balances” (dangerous; lean block in v1).
3. **Income installments** — if ever supported, same contract rules apply.

---

## Success criteria

- User extending ₱1,200 / 12 months to 14 months with **keep total** sees **~₱85.71/mo** on pending rows and unchanged past rows.
- User choosing **keep monthly** at ₱100 sees total preview **₱1,400** before confirm.
- Changing only one month’s amount with **this only** does not open plan revision.
- FE preview matches BE applied result (parity tests in `@fintr/domain`).
- No plan revision applies without preview + explicit anchor selection.

---

## References (codebase)

| Area | Location |
|------|----------|
| Create split | `Transactions::Operations::CreateTransaction#adjust_amount` |
| Schedule regen | `UpdateThisAndFutureTransactions`, `UpdateAllInSeriesTransactions` |
| Series materialize | `MaterializeSeriesChildren`, `CreateRepeatTransactions` |
| Edit scope UI | `EditTransactionDialog`, `ScopeModal` |
| Term UI | `ExpenseForm` (installment term), `formatLoanTerm` |
| Domain parity | `packages/fintr-domain`, `contract_parity_spec.rb` |
