# Fintr

Monorepo for the Fintr platform.

## Product scope

Fintr’s **live** dashboard experience does **not** currently ship dedicated **Goals** or **Investments** products for typical users; those surfaces are gated behind `NEXT_PUBLIC_SHOW_V2`. See **[docs/CURRENT_PRODUCT_SCOPE.md](docs/CURRENT_PRODUCT_SCOPE.md)** for contributors (marketing copy and legacy UI may still mention those themes).

## Structure

```
├── apps/
│   ├── fintr-be/    # Ruby on Rails backend API
│   └── fintr-fe/    # Next.js frontend application
├── docs/            # Contributor docs (see docs/API_REQUEST_PARAMETERS.md, CURRENT_PRODUCT_SCOPE.md)
└── .github/
    └── workflows/   # Unified CI/CD
```

## Getting Started

### Backend

```bash
cd apps/fintr-be
bundle install
rails server
```

### Frontend

```bash
cd apps/fintr-fe
npm install
npm run dev
```

## Git hooks (shared)

Hook **scripts** live in `.githooks/` and are committed to the repo. Hook **behavior** is defined in `prek.toml` and `scripts/git-hooks/`.

After cloning, install them once per machine:

```bash
brew install prek   # if needed
uv tool install "graphifyy[openai]" --python 3.13   # knowledge graph CLI (+ docs semantic extract)
bin/setup-git-hooks
```

| Hook | When | What runs |
|------|------|-----------|
| `pre-commit` | `git commit` | Rebuild + stage `graphify-out/` when source files change; backend scoped RSpec for changed `apps/fintr-be` files |
| `pre-push` | `git push` | Frontend Vitest / Playwright for changed `apps/fintr-fe` files |

`graphify-out/` is tracked so the knowledge graph travels with the code. The pre-commit hook rebuilds it (AST only, no API) and stages updates into the same commit — do **not** use stock `graphify hook install` (that post-commit hook leaves `graphify-out` dangling).

Skip once: `git commit --no-verify` or `git push --no-verify`. Skip only the graph rebuild: `GRAPHIFY_SKIP_HOOK=1 git commit ...`.

You do **not** need Husky or `prek install` (which writes to `.husky/_/`). Use `bin/setup-git-hooks` instead.

## Knowledge graph (graphify)

```bash
graphify query "how does auth work?"
graphify path "CreateTransaction" "Space"
graphify explain "Dry::Operation"
```

Initial / full rebuild (**code + docs**). Code is local AST; docs/images need an LLM backend:

```bash
# from repo root; uses OPENAI_API_KEY (or GEMINI/ANTHROPIC/…)
set -a && source apps/fintr-be/.env && set +a
graphify extract . --backend openai
graphify cluster-only .
```

Code-only rebuild (no API key, skips docs):

```bash
graphify extract . --code-only
graphify cluster-only .
```

`.graphifyignore` excludes agent-skill corpora, fixtures, and config YAML so the semantic pass focuses on product docs under `docs/`, `apps/*/docs/`, and READMEs. The pre-commit hook keeps the **code** graph fresh (AST only); after meaningful doc edits, re-run `graphify extract . --backend openai` (or `graphify update .` with a backend configured) and commit the updated `graphify-out/`.

## Testing

- **Backend:** `cd apps/fintr-be && bundle exec rspec`
- **Backend (changed files only):** `cd apps/fintr-be && make mchanged-specs`
- **Frontend:** `cd apps/fintr-fe && npm test`

---

_This repository was created by merging the original `Fintr-BE` and `fintr-fe-nextjs` repositories. Both original repositories remain archived for reference._
