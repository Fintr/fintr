#!/bin/bash

# Download and Import Database Dump Script
# This script:
# 1. Creates a database dump on the remote server and downloads it locally
# 2. Automatically imports it into the local Docker instance (fintr-pgvectorscale-local)
#
# Usage (from apps/fintr-be):
#   ./scripts/download-dump.sh [production|staging]
#
# Usage (from monorepo root):
#   apps/fintr-be/scripts/download-dump.sh [production|staging]
#
# Requirements:
# - Kamal (use apps/fintr-be/bin/kamal or gem install kamal)
# - Docker installed and running
# - Local container 'fintr-pgvectorscale-local' (will be started if stopped)
# - apps/fintr-be/.env with DATABASE_PASSWORD (or defaults to 'postgres')
#
# Environment Variables (from .env):
# - DATABASE_PASSWORD: Password for local database (defaults to 'postgres')
# - LOCAL_DB_CONTAINER: Container name (defaults to 'fintr-pgvectorscale-local')
# - LOCAL_DB_NAME: Database name (defaults to 'fintr_development')
# - LOCAL_DB_USER: Database user (defaults to 'fintr_rails')
# - LOCAL_DB_PORT: Database port (defaults to '5433')
# - FINTR_BE_ROOT: Override backend app root (optional)
#
# Remote SSH (from apps/fintr-be/.env.production or .env.staging — same as Kamal deploy):
# - KAMAL_SSH_HOST: Production VM hostname (default: api.fintr.ai)
# - KAMAL_DEPLOY_HOST: Legacy alias for KAMAL_SSH_HOST
# - KAMAL_SSH_USER: SSH user (default: miguel.dagatan for production, ubuntu for staging)
# - KAMAL_SSH_KEY_PATH: SSH private key (default: ~/.ssh/fintr-gcp-key)

set -euo pipefail

# Resolve apps/fintr-be and monorepo roots (same rules as config/deploy.yml and bin/kamal)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

resolve_fintr_be_root() {
  if [ -n "${FINTR_BE_ROOT:-}" ]; then
    cd "${FINTR_BE_ROOT}" && pwd
    return
  fi

  if [ -f "$SCRIPT_DIR/../config/deploy.yml" ]; then
    cd "$SCRIPT_DIR/.." && pwd
    return
  fi

  if [ -f "$(pwd)/config/deploy.yml" ]; then
    pwd
    return
  fi

  if [ -f "$(pwd)/apps/fintr-be/config/deploy.yml" ]; then
    cd "$(pwd)/apps/fintr-be" && pwd
    return
  fi

  echo "❌ Could not find apps/fintr-be (config/deploy.yml missing)."
  echo "   Run from the monorepo root or apps/fintr-be, or set FINTR_BE_ROOT."
  exit 1
}

FINTR_BE_ROOT="$(resolve_fintr_be_root)"
export FINTR_BE_ROOT

# Monorepo root: parent of apps/ when backend lives at apps/fintr-be
FINTR_BE_PARENT="$(basename "$(dirname "$FINTR_BE_ROOT")")"
if [ "$FINTR_BE_PARENT" = "apps" ]; then
  MONOREPO_ROOT="$(cd "$FINTR_BE_ROOT/../.." && pwd)"
else
  MONOREPO_ROOT="$FINTR_BE_ROOT"
fi

cd "$FINTR_BE_ROOT"

# Back-compat alias used throughout this script
PROJECT_ROOT="$FINTR_BE_ROOT"

load_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    echo "📄 Loading environment variables from ${env_file#$MONOREPO_ROOT/}..."
    set -a
    # shellcheck source=/dev/null
    source "$env_file"
    set +a
  fi
}

# Load env in override order (later files win)
load_env_file "$MONOREPO_ROOT/.env"
load_env_file "$FINTR_BE_ROOT/.env"
load_env_file "$FINTR_BE_ROOT/.env.local"

resolve_ssh_connection() {
  local env_dotenv=""

  if [ "$ENVIRONMENT" == "staging" ]; then
    env_dotenv="$FINTR_BE_ROOT/.env.staging"
  else
    env_dotenv="$FINTR_BE_ROOT/.env.production"
  fi

  if [ -f "$env_dotenv" ]; then
    echo "📄 Loading deploy environment from ${env_dotenv#$MONOREPO_ROOT/}..."
    set -a
    # shellcheck source=/dev/null
    source "$env_dotenv"
    set +a
  fi

  SSH_HOST="${KAMAL_SSH_HOST:-}"
  if [ -z "$SSH_HOST" ]; then
    SSH_HOST="${KAMAL_DEPLOY_HOST:-}"
  fi
  if [ -z "$SSH_HOST" ]; then
    if [ "$ENVIRONMENT" == "staging" ]; then
      SSH_HOST="staging-api.fintr.ai"
    else
      SSH_HOST="api.fintr.ai"
    fi
  fi

  SSH_USER="${KAMAL_SSH_USER:-}"
  if [ -z "$SSH_USER" ]; then
    if [ "$ENVIRONMENT" == "staging" ]; then
      SSH_USER="ubuntu"
    else
      SSH_USER="miguel.dagatan"
    fi
  fi

  SSH_KEY="${KAMAL_SSH_KEY_PATH:-~/.ssh/fintr-gcp-key}"
  SSH_KEY="${SSH_KEY/#\~/$HOME}"

  SSH_OPTS=()
  if [ -f "$SSH_KEY" ]; then
    SSH_OPTS+=(-i "$SSH_KEY")
    echo "   🔑 Using SSH key: $SSH_KEY"
  else
    echo "   ⚠️  SSH key not found: $SSH_KEY"
    echo "      Set KAMAL_SSH_KEY_PATH in ${env_dotenv#$MONOREPO_ROOT/}"
  fi

  local ssh_config_paths=(
    "$FINTR_BE_ROOT/config/kamal_ssh.config"
  )

  if [ "$ENVIRONMENT" != "staging" ] && [ -f "$FINTR_BE_ROOT/config/kamal_ssh.production.config" ]; then
    ssh_config_paths+=("$FINTR_BE_ROOT/config/kamal_ssh.production.config")
  fi

  for ssh_config in "${ssh_config_paths[@]}"; do
    if [ -f "$ssh_config" ]; then
      SSH_OPTS+=(-F "$ssh_config")
    fi
  done
}

# Configuration
ENVIRONMENT="${1:-production}"
CONFIG_FILE="config/deploy.yml"

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
  echo "❌ Error: Environment must be 'production' or 'staging'"
  echo "Usage: apps/fintr-be/scripts/download-dump.sh [production|staging]"
  exit 1
fi

# Use staging config if specified
if [ "$ENVIRONMENT" == "staging" ]; then
  CONFIG_FILE="config/deploy.staging.yml"
fi

# Prefer monorepo bin/kamal (sets FINTR_BE_ROOT and runs from apps/fintr-be)
KAMAL_CMD=""
if [ -x "$FINTR_BE_ROOT/bin/kamal" ]; then
  KAMAL_CMD="$FINTR_BE_ROOT/bin/kamal"
elif command -v kamal &> /dev/null; then
  KAMAL_CMD="kamal"
else
  echo "❌ Error: Kamal is not installed or not in PATH"
  echo "   From apps/fintr-be: bundle install && ./bin/kamal version"
  echo "   Or: gem install kamal"
  exit 1
fi

# Check if config file exists (use absolute path)
CONFIG_FILE_PATH="$PROJECT_ROOT/$CONFIG_FILE"
if [ ! -f "$CONFIG_FILE_PATH" ]; then
  echo "❌ Error: Config file not found: $CONFIG_FILE_PATH"
  exit 1
fi

# Update CONFIG_FILE to use absolute path for Kamal commands
CONFIG_FILE="$CONFIG_FILE_PATH"

echo "📦 Downloading database dump from $ENVIRONMENT environment..."
echo "   Backend root: $FINTR_BE_ROOT"
echo "   Monorepo root: $MONOREPO_ROOT"
echo ""

# Generate dump filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILENAME="fintr_${ENVIRONMENT}_dump_${TIMESTAMP}.sql"
LOCAL_DUMP_DIR="$PROJECT_ROOT/dumps"
LOCAL_DUMP_PATH="${LOCAL_DUMP_DIR}/${DUMP_FILENAME}"

# Create local dumps directory if it doesn't exist
mkdir -p "$LOCAL_DUMP_DIR"

# Database configuration from deploy.yml
# These should match your deploy.yml configuration
DB_NAME="fintr_production"
DB_USER="fintr_admin"
DB_HOST="fintr-be-postgres"
ACCESSORY_NAME="postgres"

if [ "$ENVIRONMENT" == "staging" ]; then
  DB_NAME="fintr_staging"
  DB_HOST="fintr-be-staging-postgres"
fi

echo "🔍 Remote Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Accessory: $ACCESSORY_NAME"
echo "   Local dump path: $LOCAL_DUMP_PATH"
echo ""

# Step 1: Create dump using direct Docker commands via SSH
# Resolve SSH settings from deploy env (deploy.yml uses ERB — do not grep the YAML)
resolve_ssh_connection

if [ -z "$SSH_HOST" ] || [[ "$SSH_HOST" == *"<%"* ]]; then
  echo "❌ Could not determine SSH host"
  echo "   Set KAMAL_SSH_HOST in apps/fintr-be/.env.production (or .env.staging)"
  exit 1
fi

echo "📋 Step 1: Creating database dump on remote server..."
echo "   SSH Host: $SSH_HOST"
echo "   SSH User: $SSH_USER"
echo ""

# Test SSH connection first
echo "   🔌 Testing SSH connection..."
if ! ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${SSH_HOST}" "echo 'SSH connection successful'" 2>&1; then
  echo ""
  echo "   ❌ SSH connection failed!"
  echo ""
  echo "   Troubleshooting:"
  echo "   1. Check if you can connect manually:"
  echo "      ssh -i ${SSH_KEY:-~/.ssh/fintr-gcp-key} ${SSH_USER}@${SSH_HOST}"
  echo ""
  echo "   2. If you need to add your SSH key to the agent:"
  echo "      ssh-add ${SSH_KEY:-~/.ssh/fintr-gcp-key}"
  echo ""
  echo "   3. Verify KAMAL_SSH_HOST, KAMAL_SSH_USER, and KAMAL_SSH_KEY_PATH in apps/fintr-be/.env.production"
  echo ""
  exit 1
fi
echo "   ✅ SSH connection successful"
echo ""

# Paths on remote server
CONTAINER_DUMP_PATH="/tmp/${DUMP_FILENAME}"
SERVER_DUMP_DIR="~/dumps"
SERVER_DUMP_PATH="${SERVER_DUMP_DIR}/${DUMP_FILENAME}"

# Step 1a: Find postgres container
echo "   🔍 Finding postgres container..."
echo "   Running: ssh ${SSH_USER}@${SSH_HOST} 'docker ps --format \"{{.Names}}\"'"
echo ""

# First, list all containers for debugging
ALL_CONTAINERS=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker ps --format '{{.Names}}'" 2>&1)
if [ $? -ne 0 ]; then
  echo "   ❌ Failed to list containers on remote server"
  echo "   Error output:"
  echo "$ALL_CONTAINERS" | sed 's/^/      /'
  exit 1
fi

echo "   Available containers:"
echo "$ALL_CONTAINERS" | sed 's/^/      /'
echo ""

# Find postgres container
POSTGRES_CONTAINER=$(echo "$ALL_CONTAINERS" | grep -i postgres | head -1 || echo "")

if [ -z "$POSTGRES_CONTAINER" ]; then
  echo "   ❌ Could not find postgres container"
  echo "   Looked for containers with 'postgres' in the name"
  exit 1
fi

echo "   ✅ Found postgres container: $POSTGRES_CONTAINER"
echo ""

# Step 1b: Create dump inside container
echo "   📥 Creating dump inside container..."
echo "   Container: $POSTGRES_CONTAINER"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

DUMP_CMD="PGPASSWORD=\"\${POSTGRES_PASSWORD}\" pg_dump -h localhost -p 5432 -U \"$DB_USER\" -d \"$DB_NAME\" --no-owner --no-privileges --clean --if-exists -f \"$CONTAINER_DUMP_PATH\""

if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker exec $POSTGRES_CONTAINER sh -c '$DUMP_CMD'" 2>&1; then
  echo "   ✅ Dump created inside container"
else
  echo "   ❌ Failed to create dump inside container"
  exit 1
fi

# Verify dump file exists in container
echo "   🔍 Verifying dump file in container..."
if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker exec $POSTGRES_CONTAINER test -f \"$CONTAINER_DUMP_PATH\"" 2>/dev/null; then
  CONTAINER_SIZE=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker exec $POSTGRES_CONTAINER sh -c 'stat -c%s \"$CONTAINER_DUMP_PATH\" 2>/dev/null || echo 0'" 2>/dev/null | tr -d ' ')
  if [ "$CONTAINER_SIZE" = "0" ] || [ -z "$CONTAINER_SIZE" ]; then
    echo "   ❌ Dump file is empty in container!"
    exit 1
  fi
  echo "   ✅ Dump file size in container: $(numfmt --to=iec-i --suffix=B "$CONTAINER_SIZE" 2>/dev/null || echo "${CONTAINER_SIZE} bytes")"
else
  echo "   ❌ Dump file not found in container!"
  exit 1
fi

echo ""

# Step 1c: Copy from container to server filesystem
echo "   📋 Copying dump from container to server..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p $SERVER_DUMP_DIR" 2>/dev/null || true

if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker cp $POSTGRES_CONTAINER:$CONTAINER_DUMP_PATH $SERVER_DUMP_PATH" 2>&1; then
  echo "   ✅ Dump copied to server: $SERVER_DUMP_PATH"
  
  # Verify file on server
  SERVER_SIZE=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "stat -c%s $SERVER_DUMP_PATH 2>/dev/null || echo 0" 2>/dev/null | tr -d ' ')
  if [ "$SERVER_SIZE" = "0" ] || [ -z "$SERVER_SIZE" ]; then
    echo "   ❌ Dump file is empty on server!"
    exit 1
  fi
  echo "   ✅ Server dump file size: $(numfmt --to=iec-i --suffix=B "$SERVER_SIZE" 2>/dev/null || echo "${SERVER_SIZE} bytes")"
else
  echo "   ❌ Failed to copy dump from container to server"
  exit 1
fi

# Clean up container dump file
echo "   🧹 Cleaning up dump file in container..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "docker exec $POSTGRES_CONTAINER rm -f \"$CONTAINER_DUMP_PATH\"" 2>/dev/null || true

echo ""

# Step 1d: Download from server to local using scp
echo "   📥 Downloading dump file from server to local..."
if scp "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}:${SERVER_DUMP_PATH}" "$LOCAL_DUMP_PATH" 2>&1; then
  echo "   ✅ Dump file downloaded successfully"
else
  echo "   ❌ Failed to download dump file via scp"
  echo "   You can try downloading manually:"
  echo "   scp -i ${SSH_KEY:-~/.ssh/fintr-gcp-key} ${SSH_USER}@${SSH_HOST}:${SERVER_DUMP_PATH} $LOCAL_DUMP_PATH"
  exit 1
fi

# Clean up server dump file
echo "   🧹 Cleaning up dump file on server..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "rm -f $SERVER_DUMP_PATH" 2>/dev/null || true

# Verify local file
if [ ! -f "$LOCAL_DUMP_PATH" ] || [ ! -s "$LOCAL_DUMP_PATH" ]; then
  echo "   ❌ Local dump file is missing or empty!"
  exit 1
fi

LOCAL_SIZE=$(stat -f%z "$LOCAL_DUMP_PATH" 2>/dev/null || stat -c%s "$LOCAL_DUMP_PATH" 2>/dev/null || echo "0")
echo "   ✅ Local dump file size: $(du -h "$LOCAL_DUMP_PATH" | cut -f1)"

# Verify the dump file contains actual SQL
echo "   🔍 Verifying dump file content..."
if grep -q "Launching command\|INFO \[" "$LOCAL_DUMP_PATH" 2>/dev/null; then
  echo "   ❌ ERROR: Dump file contains logging output instead of SQL!"
  echo "   First 10 lines:"
  head -10 "$LOCAL_DUMP_PATH" | sed 's/^/      /'
  rm -f "$LOCAL_DUMP_PATH"
  exit 1
fi

# Check for SQL statements
SQL_STATEMENTS=$(grep -cE "^(CREATE|INSERT|COPY|ALTER|DROP|SET|SELECT)" "$LOCAL_DUMP_PATH" 2>/dev/null || echo "0")
if [ "$SQL_STATEMENTS" = "0" ]; then
  echo "   ⚠️  Warning: No SQL statements found in dump file"
  echo "   First 20 lines of dump:"
  head -20 "$LOCAL_DUMP_PATH" | sed 's/^/      /'
  echo ""
  echo "   This might indicate the dump is empty or corrupted"
else
  echo "   ✅ Dump file contains $SQL_STATEMENTS SQL statements"
fi

echo ""

echo "🎉 Database dump download completed!"
echo ""
echo "📁 Local dump location: $LOCAL_DUMP_PATH"
echo "📊 File size: $(du -h "$LOCAL_DUMP_PATH" | cut -f1)"
echo ""

# Step 2: Import to local Docker instance
# Load local database configuration from environment variables (with defaults)
LOCAL_CONTAINER="${LOCAL_DB_CONTAINER:-fintr-pgvectorscale-local}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-fintr_development}"
LOCAL_DB_USER="${LOCAL_DB_USER:-fintr_rails}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5433}"
LOCAL_DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"

echo "📥 Step 2: Importing to local Docker instance..."
echo ""
echo "🔍 Local Configuration:"
echo "   Container: $LOCAL_CONTAINER"
echo "   Database: $LOCAL_DB_NAME"
echo "   User: $LOCAL_DB_USER"
echo "   Port: $LOCAL_DB_PORT"
if [ -n "${DATABASE_PASSWORD:-}" ]; then
  echo "   Password: **** (from DATABASE_PASSWORD)"
else
  echo "   Password: **** (default: postgres)"
fi
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "⚠️  Docker is not installed or not in PATH"
  echo "   Skipping local import. You can import manually later:"
  echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
  echo ""
  exit 0
fi

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${LOCAL_CONTAINER}$"; then
  echo "⚠️  Container '$LOCAL_CONTAINER' not found"
  echo "   Please start it with:"
  echo "   cd $FINTR_BE_ROOT && docker compose -f docker-compose.local.yml up -d"
  echo "   Or import manually later:"
  echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
  echo ""
  exit 0
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${LOCAL_CONTAINER}$"; then
  echo "⚠️  Container '$LOCAL_CONTAINER' exists but is not running"
  echo "   Starting container..."
  if docker start "$LOCAL_CONTAINER" > /dev/null 2>&1; then
    echo "   ✅ Container started"
    # Wait for postgres to be ready
    echo "   ⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    for i in {1..30}; do
      if docker exec "$LOCAL_CONTAINER" pg_isready -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL is ready"
        break
      fi
      if [ $i -eq 30 ]; then
        echo "   ❌ PostgreSQL did not become ready in time"
        echo "   Skipping import. You can import manually later:"
        echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
        echo ""
        exit 0
      fi
      sleep 1
    done
  else
    echo "   ❌ Failed to start container"
    echo "   Please start it manually: docker start $LOCAL_CONTAINER"
    echo "   Or import manually later:"
    echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
    echo ""
    exit 0
  fi
fi

# Check if PostgreSQL is ready
if ! docker exec "$LOCAL_CONTAINER" pg_isready -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" > /dev/null 2>&1; then
  echo "⚠️  PostgreSQL in container is not ready"
  echo "   Skipping import. You can import manually later:"
  echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
  echo ""
  exit 0
fi

# Verify dump file exists and has content
if [ ! -f "$LOCAL_DUMP_PATH" ]; then
  echo "   ❌ Dump file not found: $LOCAL_DUMP_PATH"
  exit 1
fi

DUMP_SIZE=$(stat -f%z "$LOCAL_DUMP_PATH" 2>/dev/null || stat -c%s "$LOCAL_DUMP_PATH" 2>/dev/null || echo "0")
if [ "$DUMP_SIZE" = "0" ]; then
  echo "   ❌ Dump file is empty: $LOCAL_DUMP_PATH"
  exit 1
fi

echo "   📄 Dump file size: $(du -h "$LOCAL_DUMP_PATH" | cut -f1)"
echo "   Checking dump file content..."
# Check if dump has actual SQL statements (not just comments/headers)
SQL_STATEMENTS=$(grep -c "CREATE\|INSERT\|COPY\|ALTER" "$LOCAL_DUMP_PATH" 2>/dev/null || echo "0")
if [ "$SQL_STATEMENTS" = "0" ]; then
  echo "   ⚠️  Warning: Dump file may not contain SQL statements"
  echo "   First 20 lines of dump:"
  head -20 "$LOCAL_DUMP_PATH" | sed 's/^/      /'
else
  echo "   ✅ Dump file contains $SQL_STATEMENTS SQL statements"
fi
echo ""

# Drop and recreate database (to ensure clean import)
echo "   🗑️  Dropping existing database (if exists)..."
# Terminate all connections to the database first
docker exec "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$LOCAL_DB_NAME' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

# Wait a moment for connections to close
sleep 2

# Drop the database
if docker exec "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME;" \
  > /dev/null 2>&1; then
  echo "   ✅ Database dropped (if it existed)"
else
  echo "   ⚠️  Warning: Could not drop database (may not exist or connections still active)"
fi

# Create new database
echo "   📝 Creating new database..."
if docker exec "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d postgres \
  -c "CREATE DATABASE $LOCAL_DB_NAME;" \
  > /dev/null 2>&1; then
  echo "   ✅ Database created"
else
  echo "   ❌ Failed to create database"
  echo "   Skipping import. You can import manually later:"
  echo "   docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < $LOCAL_DUMP_PATH"
  echo ""
  exit 0
fi

# Import the dump
echo "   📥 Importing dump file..."
echo "   (This may take a while depending on database size...)"
echo ""

# Prepare log file
IMPORT_LOG="$LOCAL_DUMP_DIR/import_${TIMESTAMP}.log"
touch "$IMPORT_LOG"

# Import and show output in real-time while saving to log
echo "   📋 Import output:"
echo "   ──────────────────────────────────────────────────────────────"

# Use tee to both display and save output
# We need to capture the exit code from docker exec, not tee
set +e  # Temporarily disable exit on error to capture exit code
docker exec -i "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
  < "$LOCAL_DUMP_PATH" 2>&1 | tee "$IMPORT_LOG"
IMPORT_EXIT_CODE=${PIPESTATUS[0]}
set -e  # Re-enable exit on error

echo "   ──────────────────────────────────────────────────────────────"
echo ""

# Read the saved output for analysis
IMPORT_OUTPUT=$(cat "$IMPORT_LOG" 2>/dev/null || echo "")

if [ $IMPORT_EXIT_CODE -eq 0 ]; then
  echo "   ✅ Database import completed successfully!"
else
  echo "   ⚠️  Import completed with exit code: $IMPORT_EXIT_CODE"
fi

# Check for errors in output
ERROR_COUNT=$(echo "$IMPORT_OUTPUT" | grep -ci "ERROR" || echo "0")
WARNING_COUNT=$(echo "$IMPORT_OUTPUT" | grep -ci "WARNING" || echo "0")

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "   ⚠️  Found $ERROR_COUNT error(s) during import"
  echo "   Showing all errors:"
  echo "$IMPORT_OUTPUT" | grep -i "ERROR" | sed 's/^/      /'
  echo ""
  echo "   Full import log saved to: $IMPORT_LOG"
fi

if [ "$WARNING_COUNT" -gt 0 ]; then
  echo "   ℹ️  Found $WARNING_COUNT warning(s) during import"
  if [ "$WARNING_COUNT" -le 20 ]; then
    echo "   Showing warnings:"
    echo "$IMPORT_OUTPUT" | grep -i "WARNING" | sed 's/^/      /'
  else
    echo "   Showing first 20 warnings:"
    echo "$IMPORT_OUTPUT" | grep -i "WARNING" | head -20 | sed 's/^/      /'
    echo "   ... and $((WARNING_COUNT - 20)) more (see log file)"
  fi
fi

# Verify import - check for tables and data
echo ""
echo "   🔍 Verifying import..."

# Count tables across all schemas
TABLE_COUNT=$(docker exec "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast');" \
  2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
  echo "   ❌ No tables found in database!"
  echo "   This suggests the import may have failed."
  echo "   Check the import log: $IMPORT_LOG"
  echo ""
  echo "   Attempting to show what's in the database..."
  docker exec "$LOCAL_CONTAINER" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
    "\dn" 2>&1 || true
  exit 1
fi

echo "   ✅ Found $TABLE_COUNT tables"

# Check for data in key tables
echo "   📊 Checking for data in key tables..."
DATA_FOUND=false

# Check common tables that should have data
TABLES_TO_CHECK=(
  "auth.users"
  "spaces.spaces"
  "transactions.transactions"
  "public.spaces"
  "public.transactions"
  "public.accounts"
)

for table in "${TABLES_TO_CHECK[@]}"; do
  # Try to get row count (handle schema.table and just table)
  if [[ "$table" == *"."* ]]; then
    SCHEMA=$(echo "$table" | cut -d'.' -f1)
    TABLE_NAME=$(echo "$table" | cut -d'.' -f2)
    ROW_COUNT=$(docker exec "$LOCAL_CONTAINER" \
      psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c \
      "SELECT COUNT(*) FROM \"$SCHEMA\".\"$TABLE_NAME\";" \
      2>/dev/null | tr -d ' ' || echo "0")
  else
    ROW_COUNT=$(docker exec "$LOCAL_CONTAINER" \
      psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c \
      "SELECT COUNT(*) FROM \"$table\";" \
      2>/dev/null | tr -d ' ' || echo "0")
  fi
  
  if [ "$ROW_COUNT" != "0" ] && [ -n "$ROW_COUNT" ] && [ "$ROW_COUNT" != "ERROR" ]; then
    echo "      ✅ $table: $ROW_COUNT rows"
    DATA_FOUND=true
  fi
done

if [ "$DATA_FOUND" = false ]; then
  echo "   ⚠️  No data found in key tables!"
  echo "   The import may have only created the schema without data."
  echo ""
  echo "   Checking all schemas..."
  docker exec "$LOCAL_CONTAINER" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1');" \
    2>&1 || true
  
  echo ""
  echo "   Checking table counts per schema..."
  docker exec "$LOCAL_CONTAINER" \
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
    "SELECT table_schema, COUNT(*) as table_count FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') GROUP BY table_schema ORDER BY table_schema;" \
    2>&1 || true
else
  echo "   ✅ Data found in database!"
fi

echo ""
if [ "$DATA_FOUND" = true ]; then
  echo "🎉 All done! Database imported to local Docker instance."
else
  echo "⚠️  Import completed, but no data was found in key tables."
  echo "   This might be normal if:"
  echo "   - The source database was empty"
  echo "   - The dump only contains schema (no data)"
  echo "   - Data is in different schemas/tables"
  echo ""
  echo "   Troubleshooting:"
  echo "   1. Check the import log: $IMPORT_LOG"
  echo "   2. Verify the dump file has data: grep -c 'INSERT\\|COPY' $LOCAL_DUMP_PATH"
  echo "   3. Check all schemas: docker exec $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c '\\dn'"
  echo "   4. You may need to run migrations: rails db:migrate (restores UUID primary keys if the dump omitted constraints)"
fi

echo ""
echo "📋 Summary:"
echo "   Dump file: $LOCAL_DUMP_PATH"
echo "   Import log: $IMPORT_LOG"
echo "   Local database: $LOCAL_DB_NAME"
echo "   Container: $LOCAL_CONTAINER"
echo "   Port: $LOCAL_DB_PORT"
echo "   Tables found: $TABLE_COUNT"
echo ""
echo "💡 To connect to the local database:"
echo "   docker exec -it $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME"
echo "   Or via Rails: rails db"
echo ""
echo "💡 If you need to run migrations after import:"
echo "   cd $FINTR_BE_ROOT && bundle exec rails db:migrate"
echo ""
