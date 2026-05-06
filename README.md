# Fintr

Monorepo for the Fintr platform.

## Structure

```
├── apps/
│   ├── fintr-be/    # Ruby on Rails backend API
│   └── fintr-fe/    # Next.js frontend application
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
