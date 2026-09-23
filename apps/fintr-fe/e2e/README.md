# Playwright

## Personal workspace credentials

Playwright cannot complete Google OAuth for `miguel.dagatan@gmail.com`. Use this password on `/auth` instead:

- **Email:** `miguel.dagatan@gmail.com`
- **Password:** `FintrPlaywright!Personal2026`
- **Space:** `miguel-dagatan-gmail-com-personal-space`

```ts
import { loginToPersonalWorkspace } from "./helpers/login-personal-workspace"

await loginToPersonalWorkspace(page)
```

See `e2e/backend-tdd/README.md` for full-stack setup and the development auth bypass.
