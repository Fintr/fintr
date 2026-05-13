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

## Testing

- **Backend:** `cd apps/fintr-be && bundle exec rspec`
- **Frontend:** `cd apps/fintr-fe && npm test`

---

_This repository was created by merging the original `Fintr-BE` and `fintr-fe-nextjs` repositories. Both original repositories remain archived for reference._
