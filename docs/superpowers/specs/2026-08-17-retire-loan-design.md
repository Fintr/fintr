# Retire loan (no P&L)

## Goal

Users can retire lent or borrowed loans so they leave the active book without recording bad-debt expense or forgiveness income. The same action must apply locally (IndexedDB + outbox) and on Rails when online or when the outbox drains.

## Behavior

- Retire sets `status` to `defaulted`. Un-retire sets `status` back to `active`.
- Outstanding balance is unchanged and still shown on the loan.
- Cash / account balances are unchanged. No expense or income transaction is created.
- Retired loans are excluded from active totals (you owe / they owe, upcoming payments, loan entity profiles, debt insights).
- New loan payments are rejected while `defaulted`. Un-retire restores payments.
- `recalculate_outstanding_balance!` must not change status while the loan is `defaulted`.
- UI copy: **Retired** (API value remains `defaulted`).
- List: retired loans sit with completed loans; outstanding still visible (unlike paid off, which can show “Paid off”).
- Local-first: patch caches immediately, enqueue `loan.update` with `{ id, status }`, PUT `/transactions/loans/:id`. Outbox drain uses the same update path.

## Out of scope

- Partial write-off amounts
- P&L expense or income
- New status enum values
