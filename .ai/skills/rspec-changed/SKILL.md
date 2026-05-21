---
name: rspec-changed
description: >-
  Run scoped RSpec for backend files changed in the working tree (maps app/lib
  paths to their specs). Use after editing apps/fintr-be code, before claiming
  work is done, when fixing backend specs, or when the user asks to run related
  tests only.
---

# RSpec Changed (Backend)

Run only the specs that correspond to files you changed in `apps/fintr-be`, instead of the full suite.

## When to Use

- After implementing or fixing anything under `apps/fintr-be/app/` or `apps/fintr-be/lib/`
- After updating a spec file under `apps/fintr-be/spec/`
- Before marking backend work complete (with `verification-before-completion`)
- When the user wants fast, targeted test feedback during development

## Command

From `apps/fintr-be`:

```bash
make mchanged-specs
# or
./bin/rspec-changed
```

Compare against `main` instead of unstaged/staged only:

```bash
RSPEC_CHANGED_BASE=main make mchanged-specs
```

## What It Does

`bin/rspec-changed`:

1. Collects changed paths under `app/`, `lib/`, and `spec/` (staged + unstaged; monorepo paths like `apps/fintr-be/...` are normalized)
2. Maps each source file to its spec:
   - `app/controllers/api/v1/foo_controller.rb` → `spec/requests/api/v1/foo_spec.rb`
   - `app/models/...` → `spec/models/...`
   - `app/operations/...` → `spec/operations/...`
   - `app/serializers/...` → `spec/serializers/...`
   - changed `spec/...` files are run directly
3. Runs `bundle exec rspec` on the unique spec list (via `mise exec` when available)

If no related specs exist, it exits 0 and prints which paths changed.

## Agent Workflow (Required)

After editing backend Ruby files:

1. Run `make mchanged-specs` from `apps/fintr-be` (or `./bin/rspec-changed`)
2. Fix failures in specs or implementation until the command passes
3. Only then claim the task is complete

Do **not** run the full `bundle exec rspec` suite unless the user asks or the change touches shared infrastructure (e.g. `spec/rails_helper.rb`, `config/`, migrations).

## Git Hooks (Shared Across the Team)

Hook entrypoints are **tracked in git** under `.githooks/` (`pre-commit`, `pre-push`). They call `prek run` using `prek.toml`, which runs `scripts/git-hooks/pre-commit-backend-rspec.sh` on commit when backend files changed.

Each developer wires their clone once (sets `core.hooksPath` to the tracked folder):

```bash
brew install prek   # if needed
bin/setup-git-hooks
```

Do **not** use `prek install` (that generates local shims under `.husky/_/`, which are not shared). Use `bin/setup-git-hooks` instead.

Skip hooks for one commit: `git commit --no-verify` (use sparingly).

## Related Skills

- `create-be-specs` — writing or updating individual spec files
- `fix-backend-specs` — diagnosing and fixing failing specs
- `verification-before-completion` — always run evidence-backed verification before done
