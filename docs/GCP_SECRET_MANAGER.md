# Google Secret Manager for GCP Kamal deploys

## Current default: local `.env` files (same as AWS)

Until deployers have GCP IAM for Secret Manager, GCP Kamal uses **`.env.production`** / **`.env.staging`** and **`.kamal/secrets.gcp*`** (ENV passthrough), exactly like `config/deploy.yml` + `.kamal/secrets`. No `FINTR_GCP_PROJECT` or `gcloud` is required to deploy:

```bash
cd apps/fintr-be
./bin/deploy-gcp
./bin/deploy-gcp-staging
```

Switch to GSM when your CEO grants **`roles/secretmanager.secretAccessor`** (and upload rights). Regenerate `.kamal/secrets.gcp*` with `./bin/kamal-gcp-secrets render-secrets` and restore GSM fetch lines, or keep using dotenv and use GSM only for `upload`/CI.

---

## Optional: GSM-backed deploys

When IAM is ready, GCP Kamal can read configuration from **Google Secret Manager (GSM)** instead of shared `.env` files. Team access is granted with **GCP IAM** (project roles), not personal password vaults.

## Secret naming

For each key in `apps/fintr-be/config/gcp/secret_names`, create a GSM secret:

| Environment | GSM secret ID example |
|-------------|------------------------|
| Production  | `fintr-be-production-DATABASE_PASSWORD` |
| Staging     | `fintr-be-staging-DATABASE_PASSWORD` |

The env var name inside containers stays `DATABASE_PASSWORD` (Kamal maps GSM → container env).

## Prerequisites

1. **GCP project** with Secret Manager API enabled.
2. **Google Cloud CLI (`gcloud`)** installed and on your PATH.

   macOS (Homebrew):

   ```bash
   brew install --cask google-cloud-sdk
   ```

   Add to `~/.zshrc` (new terminals pick this up automatically):

   ```bash
   source "$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc"
   ```

   Verify:

   ```bash
   gcloud --version
   ```

   If `gcloud` is installed but not found, set:

   ```bash
   export GCLOUD_BIN="$(brew --prefix)/share/google-cloud-sdk/bin/gcloud"
   ```

3. **Authenticate**:

   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. **IAM** for deployers on the GCP project:

   | Role | Why |
   |------|-----|
   | `roles/secretmanager.secretAccessor` | Read secrets (Kamal deploy, upload “unchanged” check) |
   | `roles/secretmanager.secretVersionManager` | Create secrets and add versions (`upload`) |

   Or use `roles/secretmanager.admin` for both.

   Upload needs **accessor** to compare against the latest version. Without it, upload reports `skipped_compare` instead of `unchanged`.

   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="user:you@fintr.ai" \
     --role="roles/secretmanager.secretAccessor"
   ```

4. **Ruby/Kamal** from `apps/fintr-be` (`bundle install`).

Set the project when deploying:

```bash
export FINTR_GCP_PROJECT=YOUR_PROJECT_ID
```

## One-time migration from `.env.production`

From `apps/fintr-be` (do not commit env files):

```bash
export FINTR_GCP_PROJECT=YOUR_PROJECT_ID
./bin/kamal-gcp-secrets upload production .env.production
./bin/kamal-gcp-secrets upload staging .env.staging
```

`RAILS_MASTER_KEY` is taken from `config/master.key` if it is not in the dotenv file.

`CLIENT_URL` in GSM is filled from `FRONTEND_URL` in `.env.production` when `CLIENT_URL` is absent.

Re-run upload safely: missing secrets are **created**; existing secrets get a **new version only when the value changed** (otherwise `unchanged`). The command prints a summary (`created`, `updated`, `unchanged`, `skipped_compare`, `skipped`, `failed`).

If you lack read access, use `KAMAL_GCP_SECRETS_VERBOSE=1` to see the gcloud error, or `KAMAL_GCP_SECRETS_FORCE_UPDATE=1` to add versions without comparing (not recommended for routine runs).

Keys with no value in the dotenv file are skipped (e.g. `AI_VISION_MODEL` if not defined).

## Deploy (with GSM enabled)

If `.kamal/secrets.gcp*` uses the GSM fetch helpers and `bin/deploy-gcp*` exports via `kamal-gcp-secrets export`, set `FINTR_GCP_PROJECT` before deploy. **Today’s repo default** uses dotenv only (see top of this doc); deploy with:

```bash
cd apps/fintr-be
./bin/deploy-gcp
./bin/deploy-gcp-staging
./bin/deploy-gcp app logs
```

## Manual GSM operations

Create or update a single secret:

```bash
echo -n 'secret-value' | gcloud secrets create fintr-be-production-EXAMPLE_KEY \
  --project=YOUR_PROJECT_ID \
  --replication-policy=automatic \
  --data-file=-

echo -n 'new-value' | gcloud secrets versions add fintr-be-production-EXAMPLE_KEY \
  --project=YOUR_PROJECT_ID \
  --data-file=-
```

List production secrets:

```bash
gcloud secrets list --project=YOUR_PROJECT_ID --filter='name:fintr-be-production'
```

## Regenerating `.kamal/secrets.gcp*`

After adding keys to `config/gcp/secret_names`:

```bash
./bin/kamal-gcp-secrets render-secrets production > .kamal/secrets.gcp
./bin/kamal-gcp-secrets render-secrets staging > .kamal/secrets.gcp.staging
```

Commit the updated Kamal secrets files.

## Team access

| Who | What they need |
|-----|----------------|
| Developers deploying | `secretAccessor` + SSH to the VM + Docker Hub registry token in GSM |
| CI (later) | Service account with `secretAccessor`, no personal `.env` |

AWS deploys continue to use `.env.production` / `.env.staging` and `.kamal/secrets` as today.
