# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Monorepo: Next.js 15 (App Router) frontend at `apps/fintr-fe`, Ruby on Rails API at `apps/fintr-be`. Native iOS and Android via Capacitor 7 wrapping the web app. Auth via Auth0. Local-first offline sync (IndexedDB outbox) in active development.

## Users

**Primary:** Global individuals who want to understand and control their personal finances without linking bank accounts.

They are hiring Fintr to track income and spending, categorize transactions, monitor budgets, and get AI-assisted insights from their own data — especially when manual entry, receipt capture, or privacy-first tracking fits better than automatic bank feeds.

**Secondary audiences (supported, not primary):** Couples and households sharing finances via Spaces; users in the Philippines and other markets where PHP and multi-currency workflows matter.

## Product Purpose

Fintr helps people save more, spend smarter, and afford the life they want by making personal money management fast, understandable, and actionable — without requiring bank account linking.

Success means users build consistent tracking habits, trust their numbers, and act on insights (budgets, spending patterns, loan tracking) from data they own.

## Positioning

An AI-powered personal finance assistant that turns receipts, manual entries, and user-owned data into categorized transactions and personalized insights — without bank linking or surrendering financial account credentials.

## Operating Context

- **Surfaces:** Marketing site (light theme), authenticated dashboard (dark mode default), onboarding flow, native iOS/Android apps (Capacitor).
- **Core workflows:** Record income/expenses/transfers; manage accounts and categories; set and track budgets; view insights and monthly summaries; track loans and payments; collaborate in shared Spaces.
- **Not live product pillars today:** Dedicated Goals and Investments products are gated behind `NEXT_PUBLIC_SHOW_V2` and should not be treated as shipped for typical users. See `docs/CURRENT_PRODUCT_SCOPE.md`.
- **Roadmap context:** Philippine micro-business expansion is under assessment (`docs/PHILIPPINE_SME_PIVOT_ASSESSMENT.md`) but personal finance remains the core; no pivot away from individuals.

## Capabilities and Constraints

**Shipped / in active use:**

- Transaction tracking (income, expense, transfer, loan, loan payment)
- Multi-account and multi-currency support with exchange-rate conversion
- Budgets and category management
- Insights and monthly financial summaries
- Loans module
- Shared Spaces (multi-user)
- Realtime updates via Action Cable
- Offline read mode and local-first sync (in progress)
- AI-assisted categorization and insights (RAG over user data)
- Subscriptions and App Store distribution

**Constraints:**

- No bank account linking — all data is user-entered or captured (e.g. receipts).
- Marketing copy may reference aspirational features (goals, investments) that are not production-ready; in-app scope is authoritative.
- Terminology: "Space" = shared financial workspace; "Activity" = canonical cash event (migration in progress per `docs/activity_model_migration_plan.md`).

**Undecided / open:**

- Timeline and scope for Goals and Investments as first-class product areas.
- Depth of small-business reporting beyond personal finance.

## Brand Commitments

- **Name:** Fintr
- **Tagline:** Save more. Spend smarter. Afford the life you want.
- **Voice:** Confident and modern — startup energy, AI-forward. Not a bank; a capable assistant.
- **Visual identity (incumbent, not design authority):** Navy primary (`#0A2540`), teal accent (`#0D9488`), League Spartan typography on marketing; dashboard defaults to dark mode with `text-primary` for prominent headers.
- **Assets:** Fintr logos in `Fintr-Logos` repository; DTI-registered business; live on App Store.
- **Proof points (marketing):** NVIDIA Inception, AWS Activate Founders, Google for Startups memberships.

## Evidence on Hand

| Asset | Location / note |
|-------|-----------------|
| Landing page copy and feature claims | `apps/fintr-fe/src/components/landing-page/` |
| Product scope (contributor truth) | `docs/CURRENT_PRODUCT_SCOPE.md` |
| SME pivot research | `docs/PHILIPPINE_SME_PIVOT_ASSESSMENT.md` |
| Dark mode design reference | `apps/fintr-fe/docs/DARK_MODE.md` |
| App Store listing | Live (per marketing hero) |

**Do not fabricate:** Customer testimonials, specific user counts, benchmark statistics, or pricing claims not present in repo assets.

## Product Principles

1. **User-owned data first** — Fintr works without bank linking; privacy and control are features, not limitations.
2. **AI serves the user's numbers** — Insights and categorization are grounded in actual user data, not generic advice.
3. **Habits over dashboards** — Fast input and consistent tracking matter as much as charts.
4. **Honest scope** — Ship and communicate what is live; gate experimental surfaces clearly.
5. **Global product, local fluency** — Built for individuals worldwide; Philippine context (PHP, compliance research) informs but does not narrow the primary user.

## Accessibility & Inclusion

- UI built on Radix primitives and Shadcn patterns; accessibility features expected on interactive elements.
- Dashboard supports dark mode (default on app routes) and user theme preference.
- No product-specific WCAG certification recorded; treat a11y as a quality bar for all UI work.
