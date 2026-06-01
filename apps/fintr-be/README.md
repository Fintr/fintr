# Fintr AI - Backend
Fintr is a personal finance application with heavy integration with AI. Fintr will act as your personal financial instructor, wherein it recommend when you're free to buy your wants while hitting your budgets and goals.

**Product scope:** Dedicated in-app **Goals** and **Investments** products are not first-class for typical users today (frontend is gated with `NEXT_PUBLIC_SHOW_V2`). See the monorepo **[docs/CURRENT_PRODUCT_SCOPE.md](../../docs/CURRENT_PRODUCT_SCOPE.md)** so API and pulse payloads stay aligned with that reality.

**Request parameters:** Incoming JSON/query keys are normalized to **snake_case** by `SnakeCaseParameters` middleware before controllers run. Controllers must **`permit` and read snake_case only**—do not accept duplicate camelCase keys. See **[docs/API_REQUEST_PARAMETERS.md](../../docs/API_REQUEST_PARAMETERS.md)**.

## Infrastructure
- Rails API Backend
- Postgresql 17 (We should get the latest version as much as possible)
- RESTful API
- Serialization: Blueprinter
- Job Adapter: SolidQueue
- Caching Mechanism: SolidCache (vs Sidekiq/Redis) 
- Streaming Data: SolidCable
- Deployment: Kamal
- Github Actions for CI/CD

## Installation
1. See `.ruby-version` for ruby versioning
2. Install the ruby version. We prefer using [asdf](https://asdf-vm.com/) and [asdf-ruby](https://github.com/asdf-vm/asdf-ruby)
3. Get the .env credentials from `miko@fintr.ai`.
4. `bundle install`
5. `brew install vips`
6. Install docker and docker compose for mac or windows.
7. Run `docker-compose -f docker-compose.local.yml up -d`
8. Run `docker ps` and get the container_id of the app.
9. Run `docker exec -it <container_id> bash`
10. Run `psql -U fintr_admin -d postgres`
11. Run `ALTER USER fintr_rails WITH SUPERUSER;`
12. Run `rails db:create db:migrate db:seed` in project root
13. Run these commands normally
```
rails s
in another terminal: bin/jobs start
```

## How to get included in the seed

### Through Miko
Coordinate with Miko (miko@fintr.ai), you should log-in in staging. Then Miko will get the Auth0 Data you have in staging, put it in the seeders. After pushing the change and you're included in the `seed` files, you can run `rails db:seed`

### By yourself (You still need to ask how to get the data in staging)
1. Log in the [staging.fintr.ai](https://www.staging.fintr.ai)
2. Ask Miko how to ssh into the staging server.
3. `docker ps` and get the container_id of the app.
4. `docker exec -it <container_id> bash`
5. `bundle exec rails c` - Now you're in the console.
6. Find your User. It should likely be `Auth::User.last`
7. Add your `auth_id` in the `ENV["USER_AUTH0_ID"]` in `.env` and `.env.staging`
8. Tell everyone else that you've added an `auth_id` in those .env files.
9. Edit `db/seeds/01_user_seed.rb` and add your user_details based on position.
10. `rails db:seed`. Test it.
11. Create a PR for approval.

### Migration
To migrate, please run `make migrate`. We're using timescaledb for the pgvectorscale capabilities. It's adding up lines in the `schema.rb` that renders the application unable to use so this command will remove those lines from the schemas.

To remove the lines only, run `bundle exec rails db:clean_timescaledb_schemas`

### Download dump - EC2 # Deprecated
To download the dump it's a series of steps.
1. SSH into the server
2. You have to install postgresql17, `sudo dnf install -y postgresql17`
3. Run `pg_dump -u postgres -h <server_host> fintr_be_staging > staging.dump`
4. Go back to local terminal
5. Run `scp -i <fintr.pem> ec2-user@<ec2-host-address>:/home/ec2-user/staging.dump .`

## Handling .env files
Since we're using kamal, handling `.env` files is a little bit more primitive. We have local copies of the `.env.production` and `.env.staging`. Kamal will look at those `.env` files for reference and use those for production. Please coordinate with all other team members if you wish to update `.env.production` and `.env.staging`.

## Production deploy (Kamal)

Production API and frontend run on the same host (`api.fintr.ai` / `fintr.ai`). Deploy SSH uses a **dedicated key** (`~/.ssh/fintr-gcp-key`), not your personal key. Set `KAMAL_SSH_USER`, `KAMAL_SSH_KEY_PATH`, and `KAMAL_SSH_HOST` in **`apps/fintr-be/.env.production`** — see `.env.production.example`.

**GitHub Actions:** store the private key in secret `FINTR_GCP_DEPLOY_SSH_PRIVATE_KEY`. The workflow writes it to `~/.ssh/fintr-gcp-key` on the runner (same path as local). The matching public key must be in `~/.ssh/authorized_keys` on the VM.

| Component | Kamal config | Deploy command |
|-----------|--------------|----------------|
| API | `config/deploy.yml` | `./bin/kamal deploy` (from `apps/fintr-be`) |
| Frontend | `config/deploy.fe.yml` | `./bin/deploy-fe` |

Secrets: **`.kamal/secrets`** and local **`.env.production`** (API + `apps/fintr-fe/.env.production` for web/Kamal; Capacitor uses `apps/fintr-fe/.env.mobile.production`). CI frontend deploy: `.github/workflows/deploy-fe.yml` on push to `main`.

Staging continues to use `config/deploy.staging.yml` (separate host).

## Sentry MCP Integration

This project has Sentry MCP (Model Context Protocol) configured, allowing AI assistants to interact with Sentry for error tracking and issue analysis.

### Quick Setup

Run the setup script to configure Sentry MCP:

```bash
./bin/setup-sentry-mcp.sh
```

The script will:
- Install Node.js 25.2.1 (via mise if available)
- Ensure the wrapper script is executable
- Guide you through adding your `SENTRY_ACCESS_TOKEN` to `.env`
- Provide instructions for configuring Cursor MCP settings

### Manual Setup

If you prefer to set up manually:

1. **Install Node.js v20+** (required for Sentry MCP server, project uses 25.2.1)
   - If using `mise`: Add `nodejs 25.2.1` to `.tool-versions` and run `mise install`
   - Or install from [nodejs.org](https://nodejs.org/)

2. **Add Sentry Access Token** to your `.env` file:
   ```
   SENTRY_ACCESS_TOKEN=your-sentry-access-token-here
   ```
   Get your token from: https://sentry.io/settings/account/api/auth-tokens/
   Required scopes: `org:read`, `project:read`, `project:write`, `team:read`, `team:write`, `event:read`, `event:write`

3. **Configure Cursor MCP** by adding to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "sentry-fintr": {
         "command": "/path/to/fintr-be/bin/sentry-mcp-wrapper.sh",
         "cwd": "/path/to/fintr-be"
       }
     }
   }
   ```

4. **Restart Cursor** to load the MCP server

### Usage

After setup, you can ask the AI assistant:
- "Show me unresolved issues from the last week"
- "What errors occurred today?"
- "Analyze issue PROJECT-123"
- "Count of database failures this week"

