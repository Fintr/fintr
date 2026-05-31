# GCP frontend deploy (Kamal)

The Next.js static export (`apps/fintr-fe`) deploys to the same GCP VM as the API via Kamal, configured from `apps/fintr-be`.

## Local deploy

```bash
cd apps/fintr-be

# Env: apps/fintr-fe/.env.gcp.production (frontend) + apps/fintr-be/.env.production (registry)
./bin/deploy-gcp-fe
```

Kamal builds from `apps/fintr-fe/Dockerfile` and registers **kamal-proxy** for the hostname in `FRONTEND_PROXY_HOST` or `NEXT_PUBLIC_APP_BASE_URL`. The API (`fintr-be`) must use a **different** proxy host on the same VM (e.g. `api.fintr.ai` or `gcp-api.fintr.ai`).

If the deploy succeeded but the site does not load, see **[GCP_VM_NETWORKING.md](./GCP_VM_NETWORKING.md)** (firewall ports 80/443, hostname vs IP).

## Serve the app at `gcp.fintr.ai`

Use a dedicated hostname for the GCP cutover without touching production `www.fintr.ai` yet.

### 1. DNS

In your DNS provider (Cloudflare, etc.), add:

| Type | Name | Value |
|------|------|--------|
| A | `gcp` | `34.21.206.91` |

Result: `gcp.fintr.ai` → your GCP VM.

Wait until `dig +short gcp.fintr.ai` returns the VM IP.

### 2. Environment (local + GitHub Actions)

Copy `apps/fintr-fe/.env.production` → `apps/fintr-fe/.env.gcp.production` and set GCP values (see `.env.gcp.production.example`):

```bash
NEXT_PUBLIC_APP_BASE_URL=https://gcp.fintr.ai
NEXT_PUBLIC_BE_URL=https://api.fintr.ai
FRONTEND_PROXY_HOST=gcp.fintr.ai
KAMAL_PROXY_SSL=true
```

`deploy.fe.gcp.yml` loads **`.env.gcp.production`** (not `.env.production`) plus `apps/fintr-be/.env.production` for Docker Hub credentials.

Redeploy after changing `NEXT_PUBLIC_*` (they are **build-time** for static export):

```bash
cd apps/fintr-be
./bin/deploy-gcp-fe
```

### 3. Auth0

In the Auth0 application (SPA):

- **Allowed Callback URLs:** `https://gcp.fintr.ai`, `https://gcp.fintr.ai/`
- **Allowed Logout URLs:** `https://gcp.fintr.ai`
- **Allowed Web Origins:** `https://gcp.fintr.ai`

(Keep existing `www.fintr.ai` entries until cutover.)

### 4. API CORS (fintr-be)

The Rails API must allow the new origin. In `.env.production` on the **backend** deploy (AWS or GCP):

```bash
CLIENT_URL=https://gcp.fintr.ai
CORS_ORIGINS=https://gcp.fintr.ai
```

Redeploy the API if those values are only applied at container boot.

### 5. Verify

```bash
curl -sI "https://gcp.fintr.ai/" | head -5
```

Open `https://gcp.fintr.ai` in a browser and confirm login and API calls (Network tab → requests to `NEXT_PUBLIC_BE_URL`).

## CI (GitHub Actions)

Workflow: `.github/workflows/deploy-gcp-fe.yml` — runs on **push to `main`** when `apps/fintr-fe/**` (or deploy config) changes.

### Required repository secrets

| Secret | Purpose |
|--------|---------|
| `GCP_DEPLOY_SSH_PRIVATE_KEY` | Private key for `miguel.dagatan@34.21.206.91` |
| `KAMAL_REGISTRY_USERNAME` | Docker Hub user |
| `KAMAL_REGISTRY_PASSWORD` | Docker Hub token |
| `NEXT_PUBLIC_APP_BASE_URL` | e.g. `https://gcp.fintr.ai` (GCP) or `https://www.fintr.ai` |
| `FRONTEND_PROXY_HOST` | Optional; e.g. `gcp.fintr.ai` (defaults to host from `NEXT_PUBLIC_APP_BASE_URL`) |
| `KAMAL_PROXY_SSL` | Set `true` when DNS points at the VM and you want HTTPS |
| `NEXT_PUBLIC_BE_URL` | e.g. `https://api.fintr.ai` |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | Auth0 tenant |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Auth0 SPA client |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | Auth0 API audience |
| `NEXT_PUBLIC_ENVIRONMENT` | `production` |
| `SENTRY_AUTH_TOKEN` | Sentry build token (can be empty) |

Optional: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SHOW_V2`, `FRONTEND_PROXY_HOST` (override proxy host), `KAMAL_PROXY_SSL` (`true` when TLS is ready).

**Maintenance mode:** set `NEXT_PUBLIC_MAINTENANCE_MODE=true` so non-admin users see a block page after login; Fintr admins (`isAdmin` from the API) are unaffected. Optional `NEXT_PUBLIC_MAINTENANCE_TITLE` and `NEXT_PUBLIC_MAINTENANCE_MESSAGE`.

### VM one-time setup

```bash
ssh miguel.dagatan@34.21.206.91
docker network create private 2>/dev/null || true
```

## Image

Docker Hub: `adminfintr/fintr-fe:<git-sha>`
