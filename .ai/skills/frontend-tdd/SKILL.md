---
name: frontend-tdd
description: Use when changing any file under apps/fintr-fe — components, hooks, services, utils, pages, or tests — including features, bugfixes, refactors, and when tempted to skip tests to ship faster.
---

# Frontend tests-first changes

Every production change in `apps/fintr-fe` is guarded by tests so behavior does not drift.

**Iron law:** No frontend production edit without a test run **before** and a test run **after**.

**Violating the letter of this loop is violating the spirit of this loop.**

**REQUIRED SUB-SKILL:** Use test-driven-development for new or changed behavior. Use verification-before-completion before claiming tests pass.

## When to Use

Always for `apps/fintr-fe` TypeScript/React (components, hooks, services, utils, pages).

**Exceptions (ask first):** throwaway prototypes, generated files, comment-only edits.

Thinking "skip tests just this once"? Stop. That is how unintended changes ship.

## The loop (mandatory)

```
1. Tests first   → run related tests (baseline)
2. Make changes  → smallest production edit
3. Update tests  → only for intentional behavior
4. Tests again   → same files + new tests must match intent
```

Do not start step 2 until step 1 has a fresh command output. Do not claim done until step 4 has a fresh command output.

### 1. Tests first

Identify related Vitest files, then run them **before editing production code**:

- Colocated `foo.test.ts` / `foo.test.tsx` next to the file you will change
- Tests that import the module (grep the symbol / path)
- Sibling tests in the same folder when the change is shared

```bash
cd apps/fintr-fe && pnpm test:ci src/path/to/file.test.ts
```

Use `pnpm test:ci` (`vitest run`). Do not use `pnpm test` — that is watch mode and will hang.

**Read the output.** Note what is green. That is the baseline.

- **No tests exist** for the behavior you are changing: write them now, against *current* behavior (they should pass) *or* against *intended* new behavior (they should fail for the right reason). Either way, tests exist before the production edit.
- **New feature / bugfix:** write the failing assertion first. Watch it fail because the behavior is missing, not because of a typo.
- **Refactor (behavior must not change):** baseline must be green. Do not skip the run because "I am only renaming."

### 2. Make the changes

Smallest production change that implements the request. Do not "improve" adjacent behavior while you are here.

### 3. Update tests

Update tests **only** for intentional behavior changes.

- New assertions for new behavior
- Adjust fixtures/names when the public API changed on purpose
- **Do not** weaken, delete, or skip assertions to make red tests green
- **Do not** leave stale assertions that encode the old unwanted behavior

### 4. Tests again

Re-run the **same** files from step 1, plus any new tests:

```bash
cd apps/fintr-fe && pnpm test:ci src/path/to/file.test.ts
```

| Result | Meaning | Action |
|--------|---------|--------|
| All pass, and new behavior is asserted | Intended change only | Done (for this slice) |
| Related test fails | You broke something | Fix production code, not the test |
| Unrelated assertion fails | Unintended change | Revert or isolate; do not "fix" the test to match the accident |
| New tests pass but you never saw them fail | Tests may not test the change | Prove they fail without the production edit |

If the touched module is widely imported, expand the re-run (callers' tests, folder, or `pnpm test:ci` on the relevant tree). Do not claim the frontend change is complete on a previous run, a guessed result, or "should still pass."

## Mapping to TDD

| Situation | Step 1 | Step 3 |
|-----------|--------|--------|
| New behavior | Failing test for the desired outcome | Keep that test; add edges if needed |
| Bugfix | Failing regression test that reproduces the bug | Keep it; it is the lock |
| Refactor | Existing tests, green baseline | Usually no test edits |
| Intentional behavior change | Existing tests (may go red after step 2) | Update assertions to the new contract |

Tests-after that pass immediately prove nothing. Tests-first prove the test can catch the change.

## Data source (space-scoped screens)

After `offlineSyncReady`, tests and implementation treat **IndexedDB** as the UI source of truth. Do not write a hook whose happy path is a live Rails `GET`. Network is write-through into IDB. Persisted totals come from synced artifacts — do not re-sum a different FE slice.

**React Query gate:** default `networkMode: "online"` pauses queries **and mutations** while offline. Any IDB read or `*-local-first` / outbox write must use `networkMode: "always"`, and the UI must not await Rails. See skill `indexeddb-source-of-truth`.

## Finding related tests

Prefer colocated files. This repo uses `*.test.ts` / `*.test.tsx` next to source (see `src/utils/`, `src/services/`, `src/components/`).

```bash
# from repo root
rg -l "from \"./transactionViewMoney\"|from \"@/utils/transactionViewMoney\"" apps/fintr-fe
```

E2E (`pnpm test:e2e`) is extra coverage for flows, not a substitute for the Vitest loop on unit/hook/component behavior.

## Patterns

**Pure functions** — assert input → output. One behavior per `it`.

**Hooks** — `renderHook` + `act`. Do not combine `vi.useFakeTimers()` with `waitFor` (waitFor uses real timers; fake timers make it hang). Prefer `act` + `Promise.resolve()`.

**Components** — test what the user sees (`getByRole`), not internal state. Avoid `getByTestId` when a role/name exists. Do not wrap `userEvent` in extra `act()`.

**IndexedDB / local-first** — exercise the local cache path; do not mock away the module under test and then assert on the mock.

## Commands

```bash
cd apps/fintr-fe
pnpm test:ci src/lib/myFeature.test.ts   # required loop (non-watch)
pnpm test:ui                             # debug
pnpm test:coverage
pnpm test:e2e                            # Playwright; not the default loop
```

## Common mistakes

1. Editing production code before any test run
2. Using watch-mode `pnpm test` and never reading a finished run
3. Updating tests to match an accidental behavior change
4. Testing implementation details (`component.state`) instead of user-visible behavior
5. Claiming green from an earlier session's output

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too small to test" | Small edits cause the surprising regressions. The baseline run is the point. |
| "I'll test after" | After-only tests pass immediately and miss drift. Run before **and** after. |
| "nextjs rule says skip unit tests" | That instruction is wrong. This skill and `frontend_tdd.mdc` win. |
| "It's just UI / styling" | If TS/TSX behavior can change, the loop applies. No tests? Write them in step 1. |
| "GSD Skip TDD list includes UI" | Does not apply to `apps/fintr-fe` production code. |
| "TDD if the task says so" | For fintr-fe the loop is always on, not optional. |
| "Existing tests cover it" | Then run them. Coverage you did not execute is not a baseline. |
| "Watching it fail is ritual" | A test that never failed may not test the change. |

## Red flags — STOP

- Production edit with no prior `pnpm test:ci` output in this session
- "Should still pass" / "tests are probably fine"
- Weakening or deleting a failing test to go green
- Task marked done before the after-run
- "I'll add tests in a follow-up"

**All of these mean: stop. Run the loop. Do not continue the production edit.**

## Verification checklist

- [ ] Related tests identified
- [ ] Step 1 run completed and output read (baseline)
- [ ] New/changed behavior has a test that failed for the right reason (or refactor with unchanged tests)
- [ ] Production change is the smallest that satisfies the request
- [ ] Tests updated only for intentional deltas
- [ ] Step 4 re-run of the same files is green
- [ ] No skipped/weakened assertions to hide failures

Can't check every box? The loop was skipped. Go back to step 1.

## Related

- `apps/fintr-fe/TESTING.md`
- Rule: `.ai/rules/frontend_tdd.mdc`
- Vitest: `apps/fintr-fe/vitest.config.ts`
- Setup: `apps/fintr-fe/src/test/setup.ts`
