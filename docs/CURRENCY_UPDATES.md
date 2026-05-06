# Currency-Related Updates

Summary of currency-related changes (frontend and backend).

---

## Frontend

### Add Account form
**File:** `fintr-fe/src/components/dashboard/add-account-form.tsx`

- Current Balance shows the correct symbol for the selected currency (e.g. $, ₱, €, or AED) via `getCurrencySymbol(balanceCurrency)`.
- A space is shown between the currency and the amount; padding is larger when the symbol is 3 letters (e.g. AED).
- Balance input uses thousands delimiters (commas) as you type via `useNumberInput()`.
- Currency prefix is vertically aligned with the amount.

### Account list
**File:** `fintr-fe/src/components/dashboard/account-list.tsx`

- Each account’s balance is formatted in that account’s currency (e.g. USD account shows $, PHP shows ₱).
- Total is converted to the space’s currency using today’s exchange rates.
- “Show more information” shows up to 3 lines (one per currency) and a “Total (in PHP)” when there are multiple currencies.
- Clicking a non–space-currency amount (e.g. USD) shows the equivalent in the space currency using today’s rate.

### Expense form
**File:** `fintr-fe/src/components/dashboard/forms/ExpenseForm.tsx`

- Changing the account no longer changes the transaction currency. If you pick AED and 2000 then change account to USD, the form still sends AED and 2000 (with conversion) to the API.

### Income form
**File:** `fintr-fe/src/components/dashboard/forms/IncomeForm.tsx`

- Same as Expense: changing the account does not change the transaction currency.
- “Deduct Taxes” and “Deduct Contributions” (and the Philippines tax calculator) only show when the space currency is PHP.
- The tax calculator uses the amount in PHP: if you enter 20,000 AED and convert to PHP, it uses the converted PHP amount for tax/contributions, not 20,000.
- Date and Amount are on separate rows.

### Manual rate (exchange rate picker)
**File:** `fintr-fe/src/components/dashboard/forms/AmountWithRatePicker.tsx`

- The “Manual rate” field formats the number with thousands delimiters as you type.
- Apply button and conversion use the cleaned numeric value.

### Currency list (5 at a time)
**File:** `fintr-fe/src/components/dashboard/forms/AmountWithRatePicker.tsx`

- The currency dropdown next to the amount shows at most 5 options at a time. User can type to search and see up to 5 matches.

### Utils
**File:** `fintr-fe/src/lib/utils.ts`

- `getCurrencySymbol(currencyCode)` returns the symbol for a 3-letter code (e.g. USD → $, PHP → ₱) using `Intl.NumberFormat`, with the code as fallback.

---

## Backend

### Default to space currency, PHP last

These places now use the **space’s currency** when available, and **"PHP"** only as the last fallback.

| File | Change |
|------|--------|
| `app/queries/monthly_financial_summaries/queries/date_range_summary.rb` | Zero totals use `space.currency` for the Money currency. |
| `app/operations/imports/operations/bulk_import_transactions.rb` | Imported transactions use `import_account.space.currency` for amount and balance currency. |
| `app/operations/insights/operations/create_weekly_spending.rb` | Currency fallback: first expense’s currency, then `expenses.first.space.currency`, then PHP. |
| `app/operations/budgets/operations/create_budget.rb` | `amount_currency` from space (by `space_id`), else PHP. |
| `app/operations/budgets/operations/update_budget.rb` | `amount_currency` from `budget.space.currency`, else PHP. |
| `app/operations/finance/operations/subscriptions/find_or_create_payment.rb` | Currency: params, then `space_subscription.space.currency`, then PHP. |
| `app/operations/finance/operations/payment_sessions/webhooks/handle_payment_session_succeeded.rb` | Currency: params, then plan currency, then `subscription.space.currency`, then PHP. |

**Unchanged on purpose:**  
`create_user_and_space` (first space still gets PHP). DB column defaults still PHP. Xendit client still uses params then PHP; callers pass space currency where needed.
