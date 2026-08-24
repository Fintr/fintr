# Loan payment schedule (standard installment loan)

## Goal

Implement what a normal installment loan does, and keep the UI from inventing extra due dates.

The screen should answer three questions separately:

1. **When is it due?** Original cadence (loan date + 1 month, +2 months, …). The 8th stays the 8th. Paying on August 10 does **not** move the next due to September 10.
2. **When did they pay?** The recorded payment date. Interest uses this date.
3. **What is due next?** The **original installment amount** (PMT), unless the remaining balance plus interest is smaller (last payment / payoff). Extra principal does **not** lower the monthly total. It shortens how many due dates are left. What *does* change is the **split**: less interest, more principal.

This is the default industry policy for extra payments ([keep PMT, shorten term](https://homeexpertly.com/calculators/loans/amortization/); [irregular-payment posting](https://finhelp.io/glossary/loan-amortization-with-irregular-payments-how-lenders-recalculate-balances/)). Recast (lower monthly payment, same end date) is a special bank product, often with a fee. **Out of scope.**

Do not shift due dates to `lastPaymentDate + 1 month`. That was the confusing schedule.

## Extra principal vs recast (why we keep PMT)

| Policy | Monthly total | Remaining dates | Typical use |
| --- | --- | --- | --- |
| **Keep original PMT** (implement this) | Same | Fewer / earlier payoff | Default extra principal |
| Recast / re-amortize | Lower | Same maturity | Formal lender request |

Confusion to avoid: if overpaying quietly lowered “Next payment”, people would not know whether they still owed the original installment. Standard loans still ask for the same PMT until payoff.

The “adjustment” the user sees is the **interest vs principal split**, not a new total.

## Interest (daily simple interest, Actual/365)

This is the usual model when payment dates are not exactly the due date: personal loans, auto loans, simple-interest mortgages ([Vertex42](https://www.vertex42.com/Calculators/simple-interest-loan.html), [daily simple-interest amortization](https://codingace.net/finance/daily_simple_interest_amortization.html)).

Fintr already does this on record-payment (`CalculateLoanPaymentInterest`, `calculateLoanPaymentSplit`). Keep it.

```
dailyRate     = annualRate / 100 / 365
days          = calendar days from last interest-bearing date → date being priced
interestDue   = outstandingPrincipal × dailyRate × days
```

Rules:

- Last interest-bearing date = latest payment date, else loan origination date.
- Interest is simple (no daily compounding).
- Payment order: **interest first**, then principal. Unpaid interest is **not** added to principal (no negative amortization).
- Several payments on the **same** date share one period: later payments on that day only take leftover interest.
- Day count stays **Actual/365**. Actual/360 is a different commercial convention; do not switch without a product flag.

Paying on August 10, next due September 8, balance `B`, APR `r`:

```
interestDue = B × (r / 100 / 365) × (September 8 − August 10)   // 29 days
```

Late payment: more interest in the period that just closed. Next period is shorter. Overpay: `B` is smaller, so next interest is smaller even though the **total** PMT is unchanged.

If a payment is less than `interestDue`, principal does not fall. We do not persist a separate unpaid-interest balance today; leftover interest is not carried as its own ledger. Accept that gap unless we add carry later.

## Original PMT and next suggested total

At origination:

```
monthlyRate = annualRate / 100 / 12
n           = loanTermMonths

if monthlyRate == 0:
  originalPmt = principal / n
else:
  originalPmt = principal × monthlyRate × (1 + monthlyRate)^n
                / ((1 + monthlyRate)^n − 1)
```

On the next unpaid contractual due date `D`:

1. `interestDue` as above.
2. `suggestedTotal = min(originalPmt, outstandingPrincipal + interestDue)`  
   Last payment (or heavy overpay) is payoff, not a full PMT.
3. `suggestedPrincipal = suggestedTotal − interestDue` (not below zero).

If they are overdue, Next payment still prefill **one** original PMT (plus overdue copy). Catch-up is paying that installment, then the following due date appears. Do not sum every missed PMT into one prefill; that is how “Next payment” turns into a mystery number.

Record payment prefills `suggestedTotal` and this split. The user may type another total; posting stays interest-first.

## Two timelines (this is what removes confusion)

| Surface | Dates | Amounts |
| --- | --- | --- |
| Payment history | Actual `loan_payments.date` | Actual cash and split |
| Payment schedule | Contractual due dates only | Paid: cash allocated to that due date. Future: original PMT, with interest/principal for that due date from current `B` |
| Next payment | Next unpaid contractual date | Original PMT (or payoff), plus interest and principal |

Schedule row for a met installment: **Aug 8 (Paid)**. Optional quieter **Paid on Aug 10**. Next row **Sep 8**, still original PMT.

Do **not**:

- Add schedule rows on the cash date (Aug 10) that look like extra due dates
- Move the next due date to cash date + 1 month
- Mark a due date paid until allocated cash covers that installment’s PMT (₱0.02 tolerance). Partial catch-up stays unpaid
- Recalculate a lower monthly total after overpay

Allocation: payments in date order. A payment covers the next unpaid due date when `totalPayment >= originalPmt − ₱0.02` (or remaining payoff if smaller). Extra cash on that payment reduces principal immediately, so later interest is lower and the **tail of the schedule is shorter**. It does not skip the next due date unless another covering payment exists.

## Worked example

Loan date 8 Jul. Dues **8 Aug**, **8 Sep**, … Original PMT `P`. APR 12%.

1. User pays on **10 Aug**, amount `P` plus extra.
   - Interest: `principal × 0.12 / 365 × days(8 Jul → 10 Aug)`
   - Rest reduces principal → `B'`
2. Schedule: **8 Aug (Paid)** / Paid on 10 Aug. Next due **8 Sep**.
3. Next payment **8 Sep**:
   - Total still `P` (unless `B' + interestDue < P`, then payoff)
   - Interest: `B' × 0.12 / 365 × days(10 Aug → 8 Sep)`
   - Principal: `total − interest` (larger share than a normal on-time month)

The schedule then has fewer remaining rows because `B'` amortizes sooner at the same `P`.

## Code today vs this spec

Keep:

- Daily interest on record: `CalculateLoanPaymentInterest`, `calculateLoanPaymentSplit`
- Outstanding principal = principal paid subtracted from original principal

Change to match this spec:

- Frontend `getAmortizationSchedule`: contractual dates, original PMT on future rows, shorter tail after extra principal, next due = first unpaid contractual date
- Next payment UI: show total, interest, principal using the formulas above
- `Loan#generate_amortization_schedule` / `total_value`: stop using cash-date + 1 month; align with this spec or stop using that generator for anything the user sees

One calculator for schedule + next-payment split. Prefer `@fintr/domain` so UI and Rails prefill cannot drift.

## Rounding

- Cents, half-up (`Money` / `Math.round(x * 100) / 100`)
- Covering check: ₱0.02 tolerance
- Last row absorbs leftover principal + that period’s interest

## Out of scope

- Recast (lower required monthly payment)
- Actual/360
- Late fees
- Persisted unpaid-interest ledger (optional later)

## References

- [Vertex42: daily simple interest, interest first, no capitalization](https://www.vertex42.com/Calculators/simple-interest-loan.html)
- [Daily simple interest amortization](https://codingace.net/finance/daily_simple_interest_amortization.html)
- [Extra principal keeps the monthly bill; recast is the exception](https://homeexpertly.com/calculators/loans/amortization/)
- [Irregular payments: interest then principal; recast vs shorten term](https://finhelp.io/glossary/loan-amortization-with-irregular-payments-how-lenders-recalculate-balances/)
