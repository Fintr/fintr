# Backend TDD E2E Tests

These Playwright tests exercise the **full stack** — frontend + real backend — to verify backend behavior through the UI.

## How It Works

1. **Backend bypass**: A development-only auth bypass (`secured.rb`) lets Playwright authenticate without Auth0.
2. **Test user**: The backend provides `POST /api/v1/e2e/setup` to create a persistent test user with a personal space.
3. **Request interception**: Playwright intercepts frontend API calls and injects `X-E2E-Test-*` headers.
4. **Auth0 mock**: Auth0 token refresh requests are mocked so the frontend's axios interceptor doesn't fail.

## Running the Tests

### 1. Start the backend

```bash
cd apps/fintr-be
make docker       # Start PostgreSQL/TimescaleDB
make mmigrate     # Run migrations
rails server      # Start Rails on port 3000
```

### 2. Run the e2e tests

The frontend dev server will be started automatically by Playwright.

```bash
cd apps/fintr-fe
pnpm test:e2e -- e2e/backend-tdd/
```

Or with UI mode:

```bash
pnpm test:e2e:ui -- e2e/backend-tdd/
```

### 3. Environment variables

- `E2E_BE_URL` — Override backend URL (default: `http://localhost:3000`)
- `PLAYWRIGHT_BASE_URL` — Override frontend URL (default: `http://localhost:5173`)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Playwright │────▶│   Frontend   │────▶│   Backend   │
│   (browser) │     │  (localhost  │     │ (localhost  │
│             │     │    :5173)    │     │   :3000)    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                     │                    │
       │  1. Mock Auth0     │  2. Axios adds    │  3. Bypass sees
       │     tokens         │     Bearer token  │     X-E2E-Test-*
       │                    │                    │     headers
       │  4. Intercept API  │  5. Replace auth   │  6. Load user
       │     requests       │     with bypass    │     from DB
```

## Adding New Tests

Follow the TDD pattern in `transaction-flow.spec.ts`:

1. **Arrange**: Reset test data, create/get test user, set up auth interceptors
2. **Act**: Navigate, click, fill forms — exactly as a real user would
3. **Assert**: One expectation per block. Verify backend state through the UI (e.g., transaction persists after reload)

## Safety

- The auth bypass **only works in development** (`Rails.env.development?`)
- The e2e endpoints **only work in development**
- No production code paths are affected
