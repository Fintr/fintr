#!/bin/bash

# Download and Import Database Dump Script
# This script:
# 1. Creates a database dump on the remote server and downloads it locally
# 2. Automatically imports it into the local Docker instance (fintr-pgvectorscale-local)
#
# Usage: ./scripts/download-dump.sh [environment]
# Example: ./scripts/download-dump.sh production
#
# Requirements:
# - Kamal installed and configured
# - Docker installed and running
# - Local container 'fintr-pgvectorscale-local' (will be started if stopped)
# - .env file with DATABASE_PASSWORD (or defaults to 'postgres')
#
# Environment Variables (from .env):
# - DATABASE_PASSWORD: Password for local database (defaults to 'postgres')
# - LOCAL_DB_CONTAINER: Container name (defaults to 'fintr-pgvectorscale-local')
# - LOCAL_DB_NAME: Database name (defaults to 'fintr_development')
# - LOCAL_DB_USER: Database user (defaults to 'fintr_admin')
# - LOCAL_DB_PORT: Database port (defaults to '5433')

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "📄 Loading environment variables from .env file..."
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Also try loading .env.local if it exists (common pattern for local overrides)
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  echo "📄 Loading environment variables from .env.local file..."
  set -a
  source "$PROJECT_ROOT/.env.local"
  set +a
fi

# Configuration
ENVIRONMENT="${1:-production}"
CONFIG_FILE="config/deploy.yml"

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
  echo "❌ Error: Environment must be 'production' or 'staging'"
  echo "Usage: ./scripts/download-dump.sh [production|staging]"
  exit 1
fi

# Use staging config if specified
if [ "$ENVIRONMENT" == "staging" ]; then
  CONFIG_FILE="config/deploy.staging.yml"
fi

# Check if Kamal is available
if ! command -v kamal &> /dev/null; then
  echo "❌ Error: Kamal is not installed or not in PATH"
  echo "Please install Kamal: gem install kamal"
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

# Step 1: Create dump directly to local file
# We'll dump to stdout from a container and save it locally
# Since kamal accessory exec creates a new container, we need to connect
# to the postgres service by its hostname on the network
echo "📋 Step 1: Creating database dump..."
echo "   Dumping database to local file..."

# Dump directly to stdout and save locally
# Try from postgres container first, then fallback to app container
echo "   Attempting dump from postgres container..."

if kamal accessory exec "$ACCESSORY_NAME" \
  -c "$CONFIG_FILE" \
  -- sh -c "PGPASSWORD=\"\${POSTGRES_PASSWORD}\" pg_dump -h \"$DB_HOST\" -p 5432 -U \"$DB_USER\" -d \"$DB_NAME\" --no-owner --no-privileges --clean --if-exists" > "$LOCAL_DUMP_PATH" 2>&1; then
  # Check if file was created and has content
  if [ -s "$LOCAL_DUMP_PATH" ]; then
    # Check if it's actually an error message (pg_dump errors go to stderr, but we redirected)
    if grep -q "pg_dump: error" "$LOCAL_DUMP_PATH" 2>/dev/null; then
      echo "   ❌ pg_dump error detected, trying app container instead..."
      rm -f "$LOCAL_DUMP_PATH"
      # Fallback: try from app container (which has network access to postgres)
      echo "   Attempting dump from app container..."
      if kamal app exec \
        -c "$CONFIG_FILE" \
        -- sh -c "PGPASSWORD=\"\${DATABASE_PASSWORD}\" pg_dump -h \"$DB_HOST\" -p 5432 -U \"$DB_USER\" -d \"$DB_NAME\" --no-owner --no-privileges --clean --if-exists" > "$LOCAL_DUMP_PATH" 2>&1; then
        if [ -s "$LOCAL_DUMP_PATH" ] && ! grep -q "pg_dump: error" "$LOCAL_DUMP_PATH" 2>/dev/null; then
          echo "✅ Database dump created successfully (from app container)"
        else
          echo "❌ Dump failed from app container too"
          cat "$LOCAL_DUMP_PATH"
          rm -f "$LOCAL_DUMP_PATH"
          exit 1
        fi
      else
        echo "❌ Failed to execute pg_dump from app container"
        if [ -f "$LOCAL_DUMP_PATH" ]; then
          cat "$LOCAL_DUMP_PATH"
          rm -f "$LOCAL_DUMP_PATH"
        fi
        exit 1
      fi
    else
      echo "✅ Database dump created successfully (from postgres container)"
    fi
  else
    echo "❌ Warning: Dump file is empty!"
    rm -f "$LOCAL_DUMP_PATH"
    exit 1
  fi
else
  echo "   ❌ Failed from postgres container, trying app container..."
  # Fallback: try from app container
  if kamal app exec \
    -c "$CONFIG_FILE" \
    -- sh -c "PGPASSWORD=\"\${DATABASE_PASSWORD}\" pg_dump -h \"$DB_HOST\" -p 5432 -U \"$DB_USER\" -d \"$DB_NAME\" --no-owner --no-privileges --clean --if-exists" > "$LOCAL_DUMP_PATH" 2>&1; then
    if [ -s "$LOCAL_DUMP_PATH" ] && ! grep -q "pg_dump: error" "$LOCAL_DUMP_PATH" 2>/dev/null; then
      echo "✅ Database dump created successfully (from app container)"
    else
      echo "❌ Failed to create database dump from both containers"
      if [ -f "$LOCAL_DUMP_PATH" ]; then
        echo "   Error output:"
        cat "$LOCAL_DUMP_PATH"
        rm -f "$LOCAL_DUMP_PATH"
      fi
      echo ""
      echo "   Troubleshooting steps:"
      echo "   1. Verify postgres container is running:"
      echo "      kamal accessory details $ACCESSORY_NAME -c $CONFIG_FILE"
      echo ""
      echo "   2. Test database connection from postgres container:"
      echo "      kamal accessory exec $ACCESSORY_NAME -c $CONFIG_FILE -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
      echo ""
      echo "   3. Test database connection from app container:"
      echo "      kamal app exec -c $CONFIG_FILE -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
      exit 1
    fi
  else
    echo "❌ Failed to execute pg_dump"
    if [ -f "$LOCAL_DUMP_PATH" ]; then
      cat "$LOCAL_DUMP_PATH"
      rm -f "$LOCAL_DUMP_PATH"
    fi
    exit 1
  fi
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
LOCAL_DB_USER="${LOCAL_DB_USER:-fintr_admin}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5433}"
LOCAL_DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"

echo "📥 Step 2: Importing to local Docker instance..."
echo ""
echo "🔍 Local Configuration:"
echo "   Container: $LOCAL_CONTAINER"
echo "   Database: $LOCAL_DB_NAME"
echo "   User: $LOCAL_DB_USER"
echo "   Port: $LOCAL_DB_PORT"
echo "   Password: ${LOCAL_DB_PASSWORD:+**** (set)}${LOCAL_DB_PASSWORD:-**** (using default: postgres)}"
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
  echo "   Please start it with: docker compose -f $PROJECT_ROOT/docker-compose.local.yml up -d"
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
IMPORT_OUTPUT=$(docker exec -i "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
  < "$LOCAL_DUMP_PATH" 2>&1)
IMPORT_EXIT_CODE=$?

if [ $IMPORT_EXIT_CODE -eq 0 ]; then
  echo "   ✅ Database import completed successfully!"
elif echo "$IMPORT_OUTPUT" | grep -q "ERROR"; then
  # Check if errors are just about existing objects (which is fine with --clean)
  ERROR_COUNT=$(echo "$IMPORT_OUTPUT" | grep -c "ERROR" || echo "0")
  if [ "$ERROR_COUNT" -lt 10 ]; then
    echo "   ⚠️  Import completed with minor errors (may be expected)"
    echo "   Error count: $ERROR_COUNT"
  else
    echo "   ⚠️  Import completed with errors"
    echo "   Error count: $ERROR_COUNT"
    echo "   First few errors:"
    echo "$IMPORT_OUTPUT" | grep "ERROR" | head -5 | sed 's/^/      /'
  fi
else
  echo "   ✅ Database import completed!"
fi

# Verify import
echo "   🔍 Verifying import..."
TABLE_COUNT=$(docker exec "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');" \
  2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_COUNT" != "0" ] && [ -n "$TABLE_COUNT" ]; then
  echo "   ✅ Import verified: $TABLE_COUNT tables found"
else
  echo "   ⚠️  Could not verify import (this may be normal)"
fi

echo ""
echo "🎉 All done! Database imported to local Docker instance."
echo ""
echo "📋 Summary:"
echo "   Dump file: $LOCAL_DUMP_PATH"
echo "   Local database: $LOCAL_DB_NAME"
echo "   Container: $LOCAL_CONTAINER"
echo "   Port: $LOCAL_DB_PORT"
echo ""
echo "💡 To connect to the local database:"
echo "   docker exec -it $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME"
echo "   Or via Rails: rails db"
echo ""
