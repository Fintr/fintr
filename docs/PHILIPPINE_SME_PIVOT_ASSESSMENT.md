# Philippine financial statements and a small-business pivot — assessment

**Date:** May 2026  
**Purpose:** Research Philippine financial reporting basics, compare them to what Fintr implements today, and recommend whether to pivot from personal finance toward small business (and eventually larger enterprises).

**Audience:** Product, engineering, and founders.

---

## Executive summary


| Question                                                                                    | Recommendation                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Should Fintr **fully pivot** away from personal finance?                                    | **No.** Personal finance is the live product, brand, and technical core. Abandoning it would reset GTM, churn existing users, and discard differentiated AI/receipt workflows.                                                                                                |
| Should Fintr **expand** toward Philippine small businesses?                                 | **Yes, but as a phased extension**, not a rewrite. Start with problems Fintr already solves (expense tracking, separation of business vs personal, receipts, multi-user spaces), then add **business reporting layers** only when there is clear demand and compliance scope. |
| Can the current codebase support “real” financial statements (assets, liabilities, equity)? | **Not today.** Fintr has wallets, categories, and cash-flow-style summaries—not a general ledger, chart of accounts, or PFRS-aligned statements.                                                                                                                              |
| Sensible path                                                                               | **Personal → micro business “books lite” → export/integration with accounting tools → optional deeper GL later** for segments that outgrow Fintr.                                                                                                                             |


---

## 1. Philippine financial statements (research summary)

Philippine entities report under frameworks prescribed by the **Securities and Exchange Commission (SEC)** via **Revised SRC Rule 68**, aligned with international standards adopted locally as **PFRS** (Philippine Financial Reporting Standards).

### 1.1 The accounting equation (foundation)

Under **PFRS for Small Entities (PFRS for SEs)**—the framework most relevant to small corporations—the **financial position** at a reporting date is expressed as:


| Element         | Definition (simplified)                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Assets**      | Resources controlled by the entity from past events; future economic benefits expected to flow in.      |
| **Liabilities** | Present obligations from past events; settlement expected to use resources embodying economic benefits. |
| **Equity**      | Residual interest in assets after deducting all liabilities.                                            |


Recognition uses the **accrual basis**: items enter the statements when they meet definitions and recognition criteria—not only when cash moves.

**Sources:** [PFRS for SEs (FSRSC)](http://www.pfsrsc.org/government-organization-our-standards), [PFRS for SEs full text (DMD CPA)](https://www.dmdcpa.com.ph/wp-content/uploads/2019/01/PFRS-for-Small-Entities-full-text-1.pdf), [IFRS Foundation — Philippines jurisdiction](https://www.ifrs.org/content/ifrs/home/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction.html/philippines).

### 1.2 What small entities must prepare (SEC)

For **small entities** (roughly **₱3M–₱100M** total assets or liabilities, consolidated where applicable), the SEC expects **PFRS for SEs**, including at minimum:

- **Statement of financial position** (balance sheet): assets, liabilities, equity at reporting date  
- **Statement of comprehensive income** (income statement)  
- **Statement of changes in equity**  
- **Statement of cash flows**  
- **Notes** to the financial statements

**Micro entities** (at or below **₱3M** assets or liabilities) have lighter audit rules (see below) but still need structured financial information for compliance in many cases.

**Sources:** [IFRS jurisdiction note — small entity thresholds](https://www.ifrs.org/content/ifrs/home/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction.html/philippines), [Grant Thornton — SRC Rule 68 audit threshold amendments (2026)](https://www.grantthornton.com.ph/technical-alerts/accounting-alert/2025/amendments-to-the-application-of-audit-thresholds-under-revised-src-rule-68/), [NARP Law — micro enterprise reporting (Jan 2026)](https://narplaw.com/2026/01/29/micro-enterprises-are-now-exempt-from-submitting-financial-statements/).

### 1.3 Audit and filing thresholds (2026 context)

Recent SEC guidance (e.g. **Memorandum Circular No. 4, Series of 2026**) raised the **audit threshold** to above **₱3,000,000** total assets or liabilities (from the older ₱600,000 figure). Roughly:


| Segment                              | Reporting (simplified)                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Micro** (≤ ₱3M assets/liabilities) | Generally **no audited FS** to SEC; may still file FS with **Statement of Management’s Responsibility (SMR)** under oath; may use income tax basis or PFRS for SEs |
| **Small** (> ₱3M, ≤ ₱100M)           | **Audited** financial statements typically required; PFRS for SEs                                                                                                  |
| **Medium / large**                   | PFRS for SMEs or full PFRS; higher compliance burden                                                                                                               |


**Sources:** [Grant Thornton (2026)](https://www.grantthornton.com.ph/technical-alerts/accounting-alert/2025/amendments-to-the-application-of-audit-thresholds-under-revised-src-rule-68/), [NARP Law (2026)](https://narplaw.com/2026/01/29/micro-enterprises-are-now-exempt-from-submitting-financial-statements/).

### 1.4 BIR obligations (parallel track)

Even when SEC audit is light, **Bureau of Internal Revenue (BIR)** rules still matter for operating businesses:

- **Books of accounts** must be **registered** (manual, loose-leaf, or computerized) before use.  
- **Computerized accounting systems** need BIR authorization (CAS / permit to use).  
- Gross sales/receipts **above ~₱3M** often triggers **CPA-audited FS** for tax (AITR attachments via **eAFS**).  
- Records must be kept (commonly **5 years**).

**Sources:** [BIR books of accounts guide (2026)](https://www.cpadavao.com/2026/04/The-Three-Books-of-Accounts-Required-by-the-BIR-A-Complete-Guide-for-Filipino-Taxpayers.html), [Triple i Consulting — BIR compliance](https://www.tripleiconsulting.com/books-of-accounts-with-bir/), [eAFS guide (2026)](https://mommyginger.com/what-is-eafs-a-complete-guide-for-filipino-taxpayers-updated-may-2026.html), [Aurea Law — 2026 AFS guide](https://www.aureadalaw.com/post/2026-guide-to-audited-financial-statements-for-companies-and-taxpayers).

### 1.5 Implication for product design

“Supporting Philippine financial statements” is not a single feature. It is a **compliance product** spanning:

1. **Double-entry general ledger** and chart of accounts
2. **Accrual recognition** (revenue, expenses, depreciation, provisions)
3. **Period close** and comparative periods
4. **Statement generation** mapped to PFRS for SEs line items
5. **BIR books / CAS registration** path for computerized books
6. **Audit trails**, immutability, and export for CPAs
7. Optional **eAFS / SEC filing** workflows

Fintr today covers **none** of these as first-class domains.

---

## 2. What Fintr is today (codebase assessment)

### 2.1 Product positioning


| Source                          | Statement                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/fintr-be/README.md`       | “Personal finance application” with AI as instructor for budgets and goals                                    |
| `docs/CURRENT_PRODUCT_SCOPE.md` | Live pillars: transactions, budgets, loans, insights—not full Goals/Investments (V2-gated)                    |
| Landing / terms                 | “Personal finance assistant,” Philippines-focused                                                             |
| `docs/fintr_app_ideas.txt`      | Persona 5 (small business owner): pain = mixing personal/business; angle = **separate spaces**—marketing only |


Subscription copy already nods at business (`Pro`: “power users and small businesses”; `Business` tier: teams, analytics) in `apps/fintr-be/db/seeds/06_subscription_plans_seed.rb`, but **tiers are token limits**, not accounting capabilities.

### 2.2 Domain model (personal finance, not GL)

All financial data is scoped to a `**Spaces::Space`** (tenant). Types:

- `**Spaces::PersonalSpace**` — one owned space per user  
- `**Spaces::OrganizationSpace**` — shared workspace; copies categories/accounts from a reference space; roles and invitations

Core entities:


| Entity                            | Role                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Transactions::Account`           | Cash-style wallets (`cash`, `savings`, `credit_card`, `e_wallet`, `loan`, `investment`) with **running balances** |
| `Transactions::Category`          | Income/expense taxonomy per space                                                                                 |
| `Transactions::Transaction` (STI) | Income, expense, transfer, draft, combined                                                                        |
| `Transactions::Transfer`          | Two-legged moves between accounts                                                                                 |
| `Transactions::Loan`              | Borrowed/lent with amortization-style payments                                                                    |
| `Budget`                          | Monthly category budgets                                                                                          |
| `MonthlyFinancialSummary`         | Per-space month rollup: income, expenses, net savings                                                             |
| `Ai::*`                           | Receipt OCR, RAG chat, token usage                                                                                |
| `Finance::*`                      | SaaS subscriptions (Xendit)                                                                                       |


**What is missing for business accounting:**


| Capability                                       | In Fintr?                                      |
| ------------------------------------------------ | ---------------------------------------------- |
| Chart of accounts (COA)                          | No                                             |
| Journal entries / general ledger                 | No                                             |
| Debit/credit double-entry books                  | No (transfer legs adjust wallet balances only) |
| Statement of financial position                  | No                                             |
| Statement of comprehensive income (PFRS layout)  | No                                             |
| Statement of cash flows (indirect/direct method) | No                                             |
| Equity roll-forward                              | No                                             |
| Fixed assets / depreciation                      | No                                             |
| AR/AP, invoicing, inventory                      | No                                             |
| VAT withholding, BIR forms                       | No                                             |
| BIR CAS registration artifacts                   | No                                             |


The closest analog to “profit and loss” is `**MonthlyFinancialSummary`** and dashboard `**financial_summary**` (income vs expenses vs net savings %)—a **personal cash-flow view**, not an accrual income statement.

### 2.3 What already helps a micro business (without being accounting software)

These are **reusable** if Fintr extends toward SMB:

1. **Organization spaces** — separate business from personal (`CreateOrganizationSpace`, space switcher).
2. **Multi-user access** — bookkeeper + owner (roles via Rolify).
3. **Receipt AI + categorization** — operational expense capture.
4. **Import/export** (Excel/CSV) — data pipeline toward external accounting.
5. **Multi-currency** — useful for importers and OFW-related businesses.
6. **Loans** — informal debt tracking (not formal notes payable in FS sense).
7. **Marketing roadmap** — “Export data for accounting software” (`whats-next.tsx`).

### 2.4 Architecture note

The backend’s **Dry::Operation** + **space-scoped** models are a solid foundation for **new domains** (e.g. `Accounting::LedgerEntry`) without throwing away transactions—but a GL layer would be a **large parallel subsystem**, not a rename of `Transactions::Account`.

---

## 3. Gap analysis: personal tracker vs Philippine SMB needs


| Need                                      | Personal finance (today)  | Micro business (≤₱3M) | Small corp (PFRS for SEs) |
| ----------------------------------------- | ------------------------- | --------------------- | ------------------------- |
| Track daily spending                      | Strong                    | Strong                | Partial (needs accrual)   |
| Separate business vs personal             | Partial (org space)       | Strong angle          | Required                  |
| Receipt capture                           | Strong                    | Strong                | Supporting evidence       |
| Monthly “how much did I make?”            | Strong (income − expense) | Strong                | Insufficient alone        |
| Balance sheet (assets/liabilities/equity) | No                        | Rarely filed (micro)  | Required                  |
| Audited FS / eAFS                         | N/A                       | Usually no            | Often yes (>₱3M)          |
| BIR books of accounts                     | N/A                       | Required              | Required                  |
| CPA-ready export                          | Weak                      | Needed                | Required                  |


**Insight:** The **first wedge** for small business is **operational bookkeeping and separation**, not full PFRS statements. The **second wedge** is **CPA-ready exports**. **Full statements inside Fintr** matter most when customers cannot or will not use QuickBooks/Xero/local CAS-approved tools.

---

## 4. Should Fintr pivot?

### 4.1 Full pivot (personal → SMB accounting): **not recommended now**

**Reasons:**

1. **Different buyer and job-to-be-done** — Personal users optimize habits and budgets; business users optimize compliance, tax, and lender/SEC reporting. Sales motion, support, and liability profile differ.
2. **Competitive set changes** — You compete with established accounting (QuickBooks, Xero, JuanTax ecosystem, BIR-accredited local software), not only personal apps (Moneygment, etc.).
3. **Compliance risk** — Incorrect FS or tax outputs create legal/reputational exposure; requires CPA partnerships and rigid audit trails.
4. **Engineering cost** — A minimal credible GL + PFRS for SEs reporting is **many quarters**, not a refactor of `Transactions::Account`.
5. **Current traction asset** — AI receipt + personal assistant positioning is differentiated; accounting is crowded and feature-table driven.

### 4.2 Phased extension (personal core + business lane): **recommended**

Aligns with your instinct (“small businesses first, then bigger ones”) without abandoning the installed base:

```mermaid
flowchart LR
  subgraph today [Today]
    P[Personal finance]
    O[Organization space as shared tracker]
  end

  subgraph phase1 [Phase 1 - 3 to 6 months]
    B[Business space mode]
    S[Personal vs business tagging]
    E[Enhanced export for CPA]
  end

  subgraph phase2 [Phase 2 - 6 to 12 months]
    R[P and L style business reports]
    T[Tax-ready summaries]
    I[Integrations]
  end

  subgraph phase3 [Phase 3 - optional]
    GL[General ledger]
    FS[PFRS for SEs statements]
  end

  today --> phase1 --> phase2 --> phase3
```



**Phase 1 — “Business books lite” (fits current stack)**  

- Position **Organization space** as **Business workspace** (templates: sole prop, online seller, sari-sari).  
- Enforce **business-only categories**; optional link to personal space for owner draws.  
- **Receipt → expense** with BIR-friendly fields (OR number, TIN, VATable flag) on transactions.  
- **Export packs**: monthly CSV/Excel aligned to common CPA import formats; PDF expense register.  
- **No claim** of producing audited FS inside Fintr.

**Phase 2 — “Managerial accounting”**  

- Business **P&L-style** report (cash or simple accrual flags).  
- **Balance sheet–lite** only if you introduce balance-sheet accounts (still not full PFRS).  
- Integrations: export to QuickBooks / Xero / local PH tools; JuanTax-style partners if strategic.  
- **AI** for “Is this business or personal?” and anomaly detection (on-brand).

**Phase 3 — “Compliance platform” (only if validated)**  

- Chart of accounts, journal entries, period close.  
- Generate **Statement of financial position** and **Statement of income** under PFRS for SEs mapping.  
- BIR CAS pathway, eAFS attachments—likely with **CPA firm partnerships**, not DIY only.

### 4.3 Who to serve first (Philippines)


| Segment                                                     | Fit for Fintr extension | Why                                                         |
| ----------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| **Side hustles / freelancers** mixing personal and business | Excellent               | Same user as today; org space + export                      |
| **Micro enterprises (≤₱3M)**                                | Good                    | Need books + SMR support data; often use accountant + Excel |
| **Small corporations (PFRS for SEs)**                       | Moderate later          | Need real GL or tight integration; high support burden      |
| **Medium+ (PFRS for SMEs / full PFRS)**                     | Poor fit near-term      | Different product category (ERP/accounting suite)           |


This matches SEC/BIR threshold reality: **millions of micro businesses** need **organized records** more than they need Fintr to replace their CPA’s audit.

---

## 5. Decision criteria (use before major investment)

Proceed deeper into accounting only if several are true:


| Criterion          | Question                                                       |
| ------------------ | -------------------------------------------------------------- |
| Demand             | Are ≥X% of active users already using org spaces for business? |
| Willingness to pay | Will businesses pay 3–5× personal Pro for compliance features? |
| Distribution       | Can you reach accountants/bookkeepers as channel partners?     |
| Compliance         | Do you have CPA/legal advisors to sign off on outputs?         |
| Focus              | Can personal product still get roadmap capacity?               |


If demand is weak, **stay personal** and keep business as **marketing + org space** only.

---

## 6. Concrete codebase implications (if Phase 1 is approved)

Low-risk, aligned with existing patterns:


| Change                                                                | Area                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `space_kind` or `workspace_type` on `Spaces::Space`                   | `personal` | `business` | `family`                                                |
| Business category templates                                           | Seeds / onboarding                                                                |
| Transaction fields: `document_number`, `counterparty_tin`, `vat_type` | `transactions` table + operations                                                 |
| `BusinessMonthlyReport` operation                                     | Aggregate income/expense by category (extends `MonthlyFinancialSummary` concepts) |
| Export operation                                                      | CPA-oriented CSV from existing transactions                                       |
| FE: Business onboarding + reports tab                                 | `apps/fintr-fe`                                                                   |
| Copy: stop implying audited FS until Phase 3                          | Landing, terms                                                                    |


High-risk (Phase 3 only):


| Change                                                            | Area                              |
| ----------------------------------------------------------------- | --------------------------------- |
| `Accounting::Account` (COA) distinct from `Transactions::Account` | New domain—naming collision today |
| `Accounting::JournalEntry` + double-entry validation              | New operations tree               |
| Period close, retained earnings                                   | New workflows                     |
| PFRS line-item mapping engine                                     | Reporting layer                   |


**Important:** Renaming wallet `Account` to align with accounting “accounts” without a separate COA model will confuse users and engineers. Prefer `**LedgerAccount`** / `**CoaAccount**` if GL is built.

---

## 7. Positioning language (recommended)

**Today (accurate):**  
“AI-powered personal finance for the Philippines—with shared spaces to separate business spending from personal.”

**Phase 1 (accurate):**  
“Business expense hub for Philippine micro businesses: capture receipts, organize books, export to your accountant.”

**Avoid until Phase 3:**  
“Generate audited financial statements” or “PFRS-compliant accounting”—unless built and reviewed by licensed professionals.

---

## 8. Conclusion

Philippine financial statements rest on **assets, liabilities, and equity** under **accrual accounting** and frameworks (**PFRS for SEs** for most small corporations). Fintr is architected as a **personal finance tracker** with **organization spaces** and **cash-flow summaries**, not as a general ledger or statutory reporting tool.

**Do not pivot away from personal finance.** **Do** pursue a **staged business extension**: solve separation, capture, and export first; partner with CPAs; add true financial statements only when the business justifies the compliance and engineering cost.

The codebase is **well suited for Phase 1** and **not ready for Phase 3** without a new accounting domain.

---

## References

### Philippine standards and regulation

- [FSRSC — Our Standards (PFRS, PFRS for SMEs, PFRS for SEs)](http://www.pfsrsc.org/government-organization-our-standards)  
- [IFRS Foundation — Philippines](https://www.ifrs.org/content/ifrs/home/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction.html/philippines)  
- [Grant Thornton — SRC Rule 68 audit thresholds (2026)](https://www.grantthornton.com.ph/technical-alerts/accounting-alert/2025/amendments-to-the-application-of-audit-thresholds-under-revised-src-rule-68/)  
- [NARP Law — Micro enterprise FS (Jan 2026)](https://narplaw.com/2026/01/29/micro-enterprises-are-now-exempt-from-submitting-financial-statements/)

### BIR and tax filing

- [CPA Davao — Three books of accounts (2026)](https://www.cpadavao.com/2026/04/The-Three-Books-of-Accounts-Required-by-the-BIR-A-Complete-Guide-for-Filipino-Taxpayers.html)  
- [Triple i Consulting — BIR books compliance](https://www.tripleiconsulting.com/books-of-accounts-with-bir/)  
- [Aurea Law — 2026 audited FS guide](https://www.aureadalaw.com/post/2026-guide-to-audited-financial-statements-for-companies-and-taxpayers)  
- [Mommy Ginger — eAFS guide (2026)](https://mommyginger.com/what-is-eafs-a-complete-guide-for-filipino-taxpayers-updated-may-2026.html)

### Fintr internal

- `docs/CURRENT_PRODUCT_SCOPE.md`  
- `docs/fintr_app_ideas.txt` (Persona 5 — small business owner)  
- `apps/fintr-be/README.md`  
- `apps/fintr-be/app/models/transactions/account.rb`  
- `apps/fintr-be/app/models/monthly_financial_summary.rb`  
- `apps/fintr-be/app/models/spaces/organization_space.rb`

---

*This document is strategic research, not legal or accounting advice. Confirm thresholds and filing obligations with a Philippine CPA for your target customer segment.*