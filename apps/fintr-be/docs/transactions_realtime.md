# Transactions realtime (ActionCable)

## Channel

`TransactionsChannel` streams `transactions:{space_id}`.

Clients authenticate the cable connection with the same JWT used for the API (`ApplicationCable::Connection`).

## Broadcast helper

`Transactions::Broadcasts::TransactionChange` serializes index rows (via `FilteredCombinedSerializer` on the `combined_transactions` view) and broadcasts:

| Method | Event `type` | Typical use |
|--------|--------------|-------------|
| `created` / `created_many` | `transaction_created` | Income/expense/transfer create; transfer + fee batch |
| `updated` / `updated_many` | `transaction_updated` | Edits; transfer + fee batch |
| `deleted` | `transaction_deleted` | Soft/hard deletes (payloads must be serialized **before** destroy) |

Optional `actor` payload powers peer toasts. `suppress_actor_toast: true` skips the toast (e.g. series expansion noise).

## Transfer fees

Creating/updating a transfer with a positive `transaction_cost` also creates/updates a linked **Transfer Fee** expense (`SetupTransferFeeTransaction`).

Fee description (`Transactions::Transfer#fee_transaction_description`):

- With note: `Transfer fee for: <note>, amount: <transfer amount>`
- Without note: `Transfer fee, amount: <transfer amount>`

Transfer create/update/delete broadcasts include the transfer **and** its `fee_transactions` when present (`created_many` / `updated_many` / delete snapshot).

Repeat expansion (`CreateRepeatTransfers`) creates bulk fee expenses for children, then broadcasts **child transfers + those fees** in one `created_many` (so series fees appear without a reload).

### Combined-view lag

`serialize_index_rows` prefers the Combined view. If a freshly inserted fee is not visible in the view yet, it falls back to `serialize_transactable_fallback` so clients still receive the fee row immediately.

## Frontend pairing

See `apps/fintr-fe/docs/mobile/OFFLINE_INDEXEDDB_SPIKE.md` for local-first create/delete, optimistic React Query patches, and how `useTransactionsRealtime` applies these events.
