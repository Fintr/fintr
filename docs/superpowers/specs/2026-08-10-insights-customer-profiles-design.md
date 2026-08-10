# Insights Customer Profiles Design

**Date:** 2026-08-10  
**Status:** Approved for planning  
**Surface:** Insights narratives (existing cards + headline)  
**Approach:** Profile-aware narratives (Approach 1)

## Problem

Insights narratives today report metrics and warnings, but they do not celebrate who the user is becoming financially (saver, earner, investor, spender, budgeter, debt crusher). Users should feel recognized for achievements with LinkedIn-style milestone cards, without adding a second cluttered insights section.

## Goals

- Infer multiple customer profile tags from period financial data when earned.
- Congratulate as much as possible when tags qualify.
- Combine profiles with existing narrative cards (no separate profile feed).
- Use LinkedIn-style card illustrations matching gamification badge art language.
- Fall back to today’s narrative behavior (warnings/neutrals, no illustrations) when no tags qualify or data is sparse.

## Non-goals

- New Insights dashboard section / hero block.
- Always-on “building your profile” placeholder cards.
- Shame framing for high spending.
- Changing health scores, charts, or summary tiles in this work.

## Architecture

Profiles are celebratory variants of existing narrative cards.

### Pipeline (backend + offline FE mirror)

1. Compute period metrics (existing `CreateNarratives` flow).
2. Evaluate up to six profile tags against thresholds.
3. Convert qualifying tags into positive insight cards with `profileKey` + `imageKey`.
4. Merge with non-profile narratives (budget warnings, category spikes, etc.).
5. Deduplicate overlapping positive signals.
6. Sort and keep `MAX_INSIGHTS = 3`.
7. If zero tags qualify **or** data quality tier is `sparse` → current narrative behavior, no illustrations.

Primary BE entry: `Insights::Operations::CreateNarratives`.  
Primary FE offline mirror: `apps/fintr-fe/src/services/insights/offline-narratives.ts`.  
UI: `InsightNarrativeCards` gains an optional illustration block when `imageKey` is present.

## Profile tags

| `profileKey` | Display (personal) | Display (business) | Qualifies when |
|---|---|---|---|
| `strong_saver` | Strong Saver | Healthy Margin | Savings rate / net margin ≥ 20% (existing strong band) |
| `debt_crusher` | Debt Crusher | Debt Service Healthy | Debt-to-income in the healthy/positive band (reuse existing debt insight thresholds on the positive side) |
| `steady_investor` | Steady Investor | Capital Deployed | Period investment activity ≥ max(currency floor equivalent of ~1,000 PHP, 5% of period income): transfers/expenses into `account_category: investment` **and/or** categories matching investment keywords (invest, stocks, crypto, mutual fund, ETF, brokerage, etc.) |
| `high_earner` | High Earner | Revenue Climb | Income up ≥ 15% vs equal-length prior period **and** current income > 0. (No alternate “standout” path — keep the rule single and testable.) |
| `balanced_budgeter` | Balanced Budgeter | On-Budget Operator | Budgets exist and usage ≤ 100% |
| `avid_spender` | Avid Spender | Active Operator | Expenses ≥ 70% of income **and** expenses > 0. Framed positively; soft buffer tip only if net is negative—never shame |

### Ranking (when more than 3 qualify)

1. Strong Saver  
2. Debt Crusher  
3. Steady Investor  
4. High Earner  
5. Balanced Budgeter  
6. Avid Spender  

**Slot fill order:** take profile cards in the priority order above (up to 3), then fill any remaining slots with non-profile warnings/neutrals that do not duplicate a selected profile signal. When at least one profile qualifies, celebration takes priority over the old warning-first severity sort for those slots.

### Deduping

- `strong_saver` replaces the existing positive/neutral savings insight card.
- `debt_crusher` replaces the existing positive debt insight card.
- `balanced_budgeter` applies only when under/at budget; over-budget warning still wins when over.
- Category-spike and over-budget warnings remain eligible when profiles do not cover them.

## API / type shape

Additive fields on insight cards (snake_case on BE, camelCase on FE via existing serializers/transforms):

```ts
InsightCard {
  type: string;
  severity: "positive" | "neutral" | "warning";
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  profileKey?: 
    | "strong_saver"
    | "high_earner"
    | "steady_investor"
    | "avid_spender"
    | "balanced_budgeter"
    | "debt_crusher";
  imageKey?: string; // e.g. "strong_saver" → /profiles/strong_saver.png
}
```

Headline: when ≥1 profile qualifies, prefer a celebratory headline that mentions the strongest selected tag plus a concrete money highlight (net or income). Otherwise keep today’s headline logic.

## UI & illustrations

When `imageKey` is present, render LinkedIn milestone-style cards:

1. Illustration on top (flat pastel, thin line art; same language as gamification `/badges/*` and LinkedIn celebration cards).
2. Title = profile display name.
3. Body = short congratulatory sentence with a concrete number.
4. Optional action link unchanged.

When `imageKey` is absent, keep today’s compact severity cards (icon + text).

### Assets

Six new PNGs under `apps/fintr-fe/public/profiles/`:

- `strong_saver.png`
- `high_earner.png`
- `steady_investor.png`
- `avid_spender.png`
- `balanced_budgeter.png`
- `debt_crusher.png`

Catalog helper mirrors `badgeImageForKey` (e.g. `profileImageForKey`).

## Copy tone

- Profile cards: congratulate first; mild tips only if they fit without killing the win.
- Non-profile cards: unchanged.
- Avid Spender: “living your money” energy; optional soft buffer note only if net is weak.

## Offline parity

Mirror tag rules, ranking, dedupe, sparse skip, and copy in `offline-narratives.ts` so cached insights match online.

## Testing

- BE: extend `create_narratives_spec` for each tag qualify/fail, ranking, dedupe, sparse skip, business label mapping.
- FE: offline narratives unit tests; narrative card rendering with and without illustration.
- Do not use Faker.

## Out of scope follow-ups

- Dedicated profile gallery or shareable milestone posts.
- Persistent stored “customer persona” entity across periods.
- LLM-generated freeform profile copy (rules + templates only for this release).
