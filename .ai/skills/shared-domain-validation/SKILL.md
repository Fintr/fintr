---
name: shared-domain-validation
description: >-
  Add or change client/server validation using @fintr/domain (FIN-197). Use when
  writing forms, local-first services, offline mirrors, or Dry::Operation
  contracts so FE and BE rules stay in sync.
---

# Shared domain validation (`@fintr/domain`)

**Ticket:** [FIN-197](https://www.kiron.app/app/projects/kiron/FIN?card=FIN-197) — Shared validation & domain package  
**Parent epic:** FIN-193 (offline-first)

## Principle

> All validations on the FE must not mean the BE is blind — **same rules, two layers.**

The FE runs Zod from `@fintr/domain`. The BE keeps `Dry::Validation::Contract` in operations. Both must agree.

## Package location

```
packages/fintr-domain/
  src/primitives.ts          # SCHEDULE_TYPES, REPEAT_INTERVALS, etc.
  src/schemas/               # Zod schemas per operation
  fixtures/*.parity.json     # Shared examples for cross-layer tests
```

Imported in FE as `@fintr/domain` (`apps/fintr-fe/package.json` → `file:../../packages/fintr-domain`).

## Workflow: new or changed validation

### 1. Backend contract (source of truth for server behavior)

Locate or add `class Contract < Dry::Validation::Contract` in the operation under `apps/fintr-be/app/operations/`.

### 2. Zod schema (FE + parity)

Add `packages/fintr-domain/src/schemas/<operation>.ts`:

- `*ClientSchema` — camelCase shape used by forms and `*-local-first.ts`
- `*ParamsSchema` — snake_case shape matching API / operation params
- `assert*ForOptimistic()` — throws `{ success: false, message, details }` for local-first gates

Export from `packages/fintr-domain/src/index.ts`.

### 3. Parity fixtures

Add cases to `packages/fintr-domain/fixtures/<operation>.parity.json`:

```json
{
  "name": "human-readable case",
  "payload": { "user_id": "...", "space_id": "...", ... },
  "expect_valid": true
}
```

Invalid cases include `"expected_error_keys": ["repeat_interval"]`.

### 4. Backend parity spec

Extend `apps/fintr-be/spec/lib/fintr/domain/contract_parity_spec.rb` to load the fixture and call the Dry contract.

Run:

```bash
cd apps/fintr-be && bundle exec rspec spec/lib/fintr/domain/contract_parity_spec.rb
```

### 5. Package tests

```bash
cd packages/fintr-domain && pnpm test
```

### 6. Wire FE consumers

- **Local-first:** `assertCreateTransactionForOptimistic`, `assertCreateTransferForOptimistic`, etc.
- **Forms:** import `*ClientSchema` instead of inline `z.object(...)` in components.
- **Do not** duplicate rules in `validate*ForOptimistic` helpers — delete inline copies.

### 7. Shared constants

When adding enums (schedule types, repeat intervals, scopes), update:

- `packages/fintr-domain/src/primitives.ts`
- `apps/fintr-be/lib/fintr/domain/constants.rb`

## Tests to run before finishing

```bash
cd packages/fintr-domain && pnpm test
cd apps/fintr-fe && pnpm test:ci <relevant-local-first-or-form-tests>
cd apps/fintr-be && make mchanged-specs   # includes parity spec when touched
```

## Anti-patterns

- Inline validation in `create-local-first.ts` / forms that mirrors a Dry contract
- FE-only rules with no BE equivalent (unless explicitly UI-only, e.g. string amount parsing)
- Changing BE contract without updating `@fintr/domain` + fixtures
- Using Faker in parity fixtures or tests

## Related docs

- `packages/fintr-domain/README.md`
- `apps/fintr-fe/docs/mobile/OFFLINE_INDEXEDDB_SPIKE.md` (offline write path)
- Rule: `.cursor/rules/shared_domain_validation.mdc`
