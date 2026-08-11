# @fintr/domain

Shared validation and domain primitives for Fintr ( **[FIN-197](https://www.kiron.app/app/projects/kiron/FIN?card=FIN-197)** ).

## Why this exists

Fintr is moving **offline-first** ([FIN-193](https://www.kiron.app/app/projects/kiron/FIN?card=FIN-193)). The client validates and applies writes locally before sync. Without a shared package, FE Zod and BE `Dry::Validation::Contract` drift apart and users see optimistic rows that the server rejects.

**Rule:** same business rules on both layers. FE uses this package; BE keeps operation contracts.

## What's inside

| Export | Purpose |
|--------|---------|
| `src/primitives.ts` | `SCHEDULE_TYPES`, `REPEAT_INTERVALS`, `DELETE_SCOPES`, … |
| `src/schemas/*.ts` | Zod schemas mirroring `Dry::Operation` contracts |
| `fixtures/*.parity.json` | Examples validated by Vitest **and** RSpec parity spec |
| `assert*ForOptimistic()` | Throw structured failures before local-first writes |

## Usage (frontend)

```typescript
import {
  assertCreateTransactionForOptimistic,
  createTransactionClientSchema,
  REPEAT_INTERVALS,
} from "@fintr/domain";

// Local-first gate (throws { success: false, message, details })
assertCreateTransactionForOptimistic(payload);

// Forms
const result = createTransactionClientSchema.safeParse(values);
```

Dependency: `"@fintr/domain": "file:../../packages/fintr-domain"` in `apps/fintr-fe`.

## Usage (backend)

- Enforce rules in `Dry::Validation::Contract` (unchanged).
- Shared enums: `Fintr::Domain::Constants` in `apps/fintr-be/lib/fintr/domain/constants.rb`.
- Parity: `spec/lib/fintr/domain/contract_parity_spec.rb` loads `fixtures/*.parity.json`.

When you change a contract, update **Zod + fixtures + parity spec** in the same PR.

## Adding a new contract

See skill: `.ai/skills/shared-domain-validation/SKILL.md`

1. Add Zod schema under `src/schemas/`
2. Add parity fixtures
3. Extend `contract_parity_spec.rb`
4. Import from FE forms / `*-local-first.ts`
5. Run `pnpm test` here and relevant FE/BE specs

## Scripts

```bash
pnpm test        # Vitest unit tests
pnpm test:watch
```

## Status

| Contract | Client schema | Params schema | Local-first wired | Form wired |
|----------|---------------|---------------|-------------------|------------|
| Create transaction | ✅ | ✅ | ✅ | ⬜ migrate forms |
| Create transfer | ✅ | ✅ | ✅ | ⬜ migrate forms |
| Delete transaction | ✅ | ✅ | ⬜ | ⬜ |
| Loan payment create | ⬜ | ⬜ | ⬜ inline | ⬜ |
