# Backend currency system

This document is for **developers and AI assistants** working on `fintr-be`. It describes how currencies, exchange rates, persisted conversion metadata, and account balances relate, and which operations to use so behavior stays consistent.

---

## Core concepts

### Space currency

Each `Spaces::Space` has a `currency` (ISO code, e.g. `PHP`, `USD`). It is the **default display / input context** for amounts in that space when the user is not explicitly in “original currency + manual rate” mode.

### Account currency

Each `Transactions::Account` has `balance_currency`. The **running balance** on the account (`balance_cents` / `balance_currency`) is always expressed in this currency.

### Transaction amount

Each `Transactions::Transaction` has `amount_cents` / `amount_currency` (and related `balance_*` fields for running balance on the row). After a successful create/update through the normal pipeline, **`amount` is the booked (ledger) amount** in the currency implied by `amount_currency`—typically **account currency** when a conversion was applied at create time.

### Income / expense sign

- **Income:** `transaction.value` is the positive `amount`.
- **Expense:** `transaction.value` is a negative `Money` in the same currency as `amount`.

Balance math uses this **signed** numeric effect (`transaction.value.amount`).

---

## Exchange rate semantics (`FetchRate`)

`ExchangeRates::Operations::FetchRate` returns a `rate` such that:

```text
amount_in_to_currency = amount_in_from_currency × rate
```

This matches `ExchangeRates::Operations::AmountInSpaceCurrency` and the cached rates in `ExchangeRates::ApiExchangeRate` (USD base, per `ExchangeRates::ApiExchangeRate::BASE_CURRENCY`).

Always pass explicit `from_currency` and `to_currency`. Do not assume the inverse rate without going through `FetchRate` or the same formula used elsewhere.

---

## `CurrencyConversion` rows are directed (one leg)

Each `ExchangeRates::CurrencyConversion` record stores **one** direction: `original_currency` / `original_amount` → `converted_currency` / `converted_amount`.

- **Forward multiplier** (stored leg): `m = converted_amount / original_amount` (same as `exchange_rate_as_multiplier` and the persisted `exchange_rate` after `UpsertCurrencyConversion` / backfill).
- **Reverse leg** (`converted_currency` → `original_currency`): use **`1 / m`**, not the same scalar as for the forward leg.
- **API helpers:** use `CurrencyConversion#multiplier(from_currency:, to_currency:)` so inversion is explicit and tested. It returns `nil` when `(from, to)` is not either leg of that row (including `from == to`).

Do not reuse a serialized `exchangeRate` from a row for the opposite `(from, to)` without going through `multiplier` or `FetchRate(to, from)`.

---

## Creating and updating transactions

### `CreateTransaction` — `prepare_conversion`

`Transactions::Operations::CreateTransaction#prepare_conversion` decides how incoming `amount` maps to the account:

1. **Initial balance** (`initial_balance: true`): marks the opening-balance transaction from onboarding; `amount` is already in **account currency**; no FX.
2. **Manual path:** `original_currency` + `exchange_rate` present → `amount` is in **original** currency; converted amount and rate metadata are computed for storage.
3. **Explicit amount currency** (`amount_in_currency` ISO code): when it equals the account’s `balance_currency`, `amount` is treated as **account currency** (no FX). When it equals the space currency and the account differs, `amount` is treated as **space currency** and converted with **FetchRate** (same as omitting this field for that case).
4. **Space vs account (inferred):** if account currency ≠ space currency and none of the above apply, **FetchRate** is used to derive the amount stored on the transaction in **account currency**, and conversion metadata for persistence.

### `transform_params`

After conversion, `amount` and `amount_currency` on the params are set to the **converted (booked)** values when `needs_conversion` is true.

### `PersistCurrencyConversion` (metadata only)

`Transactions::Operations::PersistCurrencyConversion` does **not** recompute balances. It persists (or updates) **`ExchangeRates::CurrencyConversion`** via `ExchangeRates::Operations::UpsertCurrencyConversion` so the app keeps:

- original amount / currency (e.g. what the user typed or space-currency input),
- converted amount / currency (booked leg, aligned with account),
- `exchange_rate` (always **converted ÷ original** for the stored leg, set in `UpsertCurrencyConversion` from the amounts; client-supplied rate is not stored verbatim),
- `source`, `rate_timestamp`.

The transaction row holds the **booked** amount; the conversion row holds **audit / UI** context.

Models include `HasCurrencyConversion` (`has_one :currency_conversion`). Helpers such as `original_amount` refer to the conversion record when present.

---

## Display vs storage

- **`ExchangeRates::Operations::AmountInSpaceCurrency`:** expresses a stored amount in **space currency** for UI (uses `FetchRate` when needed; may fall back to booked currency if the rate is missing). Pass **`strict: true`** to require a rate (used for index **totals** so sums never mix foreign units into space currency).
- **`ExchangeRates::Operations::SpaceAmountToAccountCurrency`:** used when converting an amount from **space currency** into **account currency** for API params (e.g. create flow alignment).

---

## Account balance apply / revert / repeat (critical)

### Do not use `Money` subtraction across currencies

`Money` arithmetic can call `Money::Bank#exchange_to` and raise `Money::Bank::UnknownRate` when ISO codes differ and no bank rate exists. Balance updates should use **numeric amounts in `account.balance_currency`** and assign `Money.from_amount(..., account.balance_currency)`.

### List / index display (`Transaction#amount_in_space_currency`)

Index responses use `FilteredCombinedSerializer`, which reads `transactable.amount_in_space_currency` for each transaction. That method delegates to **`ExchangeRates::Operations::AmountInSpaceForTransactable.display_payload`** (shared with transfers).

If a row has **`currency_conversion`** and the persisted **`original_currency`** equals the **space currency**, the UI amount must reflect what the user entered in space terms (e.g. **1,000 PHP**), not the **converted** account-currency number (e.g. 16.48) paired with the space ISO code. Otherwise a mismatched `amount_currency` (e.g. PHP) with a converted numeric value can trigger the “same currency” fast path in `AmountInSpaceCurrency` and incorrectly show **₱16.48**.

In that case `#amount_in_space_currency` uses **`currency_conversion.original_money`** with the **same sign** as `value` (income vs expense), then `AmountInSpaceCurrency` for all other cases.

### Transaction index totals (`TotalsByType`)

`Transactions::Queries::TotalsByType` sums **`transactable.amount_numeric_for_space_total`** per row (implemented via **`ExchangeRates::Operations::AmountInSpaceForTransactable.totals_amount_decimal`**) so aggregates stay in **space currency** even when list rows fall back to native currency (e.g. USD) because `AmountInSpaceCurrency` could not rate-convert for display. That path uses **`AmountInSpaceCurrency`** with **`strict: true`** (no foreign-currency fallback). Rows missing FX are logged and contribute **0** to totals so PHP totals are not polluted with USD numerals.

Expenses still use **positive magnitudes** in the expense bucket (`amount.abs` per expense) for the API shape clients expect.

### `Transactions::Operations::Accounts::ResolveSignedBalanceEffect`

This is the **single entry point** for “signed effect of this transaction on this account’s balance currency” when:

- applying a calculated transaction (`CalculateBalance`),
- removing calculation (`RemoveCalculation`),
- deleting a calculated transaction (`DeleteThisTransaction`),
- repeating transactions with calculated balance (`CreateRepeatTransactions`).

**Rules:**

1. If the transaction has a **`currency_conversion`** row and `converted_currency` matches `account.balance_currency`, the booked effect is **`transaction.value.amount`** (already at the rate captured at create/update). **Do not** call `FetchRate` again for that leg—rates drift and would desync reversals from what was booked.

2. Otherwise (no persisted conversion, or legacy rows where `amount_currency` ≠ account currency without a matching conversion record), delegate to **`ExchangeRates::Operations::ConvertSignedAmount`**, which uses `FetchRate` when currencies differ.

### `ExchangeRates::Operations::ConvertSignedAmount`

Lower-level helper: signed decimal in → signed decimal out, using `FetchRate` when `from_currency ≠ to_currency`. When currencies match, it rounds and returns without hitting the API/cache path.

Prefer **`ResolveSignedBalanceEffect`** for transaction↔account balance effects unless you have a one-off that is explicitly not transaction-bound.

---

## Transfers and loans

- **Transfers:** `Transactions::Operations::Transfers::*` mirror conversion persistence (`Transfers::PersistCurrencyConversion`, etc.). Same idea: persist metadata; amounts on the transfer/leg models follow their own rules—see those operations before changing behavior.
- **Loans:** balance adjustments often use `Money.from_amount` with explicit account currency; follow existing loan operations for patterns.

---

## Bulk teardown vs per-transaction delete

- **`Spaces::Operations::ResetData`** destroys rows (e.g. `transactions.destroy_all`) and does **not** walk per-transaction balance reverts.
- **`Transactions::Operations::DeleteThisTransaction`** reverts a **calculated** transaction’s effect using **`ResolveSignedBalanceEffect`** then deletes the row.

---

## Quick reference (main files)

| Concern | Primary code |
|--------|----------------|
| Rate lookup / cache / API | `app/operations/exchange_rates/operations/fetch_rate.rb`, `app/models/exchange_rates/api_exchange_rate.rb` |
| Space display amount | `app/operations/exchange_rates/operations/amount_in_space_currency.rb` |
| Space → account param conversion | `app/operations/exchange_rates/operations/space_amount_to_account_currency.rb` |
| Signed amount conversion (generic) | `app/operations/exchange_rates/operations/convert_signed_amount.rb` |
| Transaction create conversion orchestration | `app/operations/transactions/operations/create_transaction.rb` |
| Persist conversion metadata | `app/operations/transactions/operations/persist_currency_conversion.rb`, `app/operations/exchange_rates/operations/upsert_currency_conversion.rb` |
| Balance effect (booked vs fetch) | `app/operations/transactions/operations/accounts/resolve_signed_balance_effect.rb` |
| Apply calculation to balance | `app/operations/transactions/operations/accounts/calculate_balance.rb` |
| Undo calculation | `app/operations/transactions/operations/accounts/remove_calculation.rb` |
| Delete + revert | `app/operations/transactions/operations/delete_this_transaction.rb` |

---

## Changelog-style notes

For a shorter list of **recent** currency-related edits across FE/BE, see the repo root `docs/CURRENCY_UPDATES.md`. This file (`fintr-be/docs/currency_system.md`) is the **conceptual system** reference; keep it updated when behavior or contracts change.
