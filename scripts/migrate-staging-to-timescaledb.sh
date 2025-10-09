#!/bin/bash

# Staging Database Migration Script
# This script migrates data from the old PostgreSQL database to the new TimescaleDB setup

set -e

echo "🚀 Starting staging database migration to TimescaleDB..."

# Configuration
OLD_DB_HOST="${OLD_DATABASE_HOST:-staging-api.fintr.ai}"
OLD_DB_PORT="${OLD_DATABASE_PORT:-5432}"
OLD_DB_NAME="${OLD_DATABASE_NAME:-fintr_staging_old}"
OLD_DB_USER="${OLD_DATABASE_USER:-fintr_rails}"
OLD_DB_PASSWORD="${OLD_DATABASE_PASSWORD}"

NEW_DB_HOST="${DATABASE_HOST:-staging-api.fintr.ai}"
NEW_DB_PORT="${DATABASE_PORT:-5432}"
NEW_DB_NAME="${DATABASE_NAME:-fintr_staging}"
NEW_DB_USER="${DATABASE_USER:-fintr_rails}"
NEW_DB_PASSWORD="${DATABASE_PASSWORD}"

# Check if required environment variables are set
if [ -z "$OLD_DB_PASSWORD" ] || [ -z "$NEW_DB_PASSWORD" ]; then
    echo "❌ Error: OLD_DATABASE_PASSWORD and DATABASE_PASSWORD must be set"
    echo "Usage: OLD_DATABASE_PASSWORD=old_password DATABASE_PASSWORD=new_password ./scripts/migrate-staging-to-timescaledb.sh"
    exit 1
fi

echo "📋 Migration Configuration:"
echo "  Old DB: ${OLD_DB_USER}@${OLD_DB_HOST}:${OLD_DB_PORT}/${OLD_DB_NAME}"
echo "  New DB: ${NEW_DB_USER}@${NEW_DB_HOST}:${NEW_DB_PORT}/${NEW_DB_NAME}"

# Test connections
echo "🔍 Testing database connections..."

# Test old database connection
if ! PGPASSWORD="$OLD_DB_PASSWORD" pg_isready -h "$OLD_DB_HOST" -p "$OLD_DB_PORT" -U "$OLD_DB_USER" -d "$OLD_DB_NAME" > /dev/null 2>&1; then
    echo "❌ Cannot connect to old database. Please check your OLD_DATABASE_* environment variables."
    exit 1
fi

# Test new database connection
if ! PGPASSWORD="$NEW_DB_PASSWORD" pg_isready -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" > /dev/null 2>&1; then
    echo "❌ Cannot connect to new database. Please check your DATABASE_* environment variables."
    exit 1
fi

echo "✅ Database connections successful!"

# Create backup directory
BACKUP_DIR="/tmp/fintr_migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📁 Created backup directory: $BACKUP_DIR"

# Function to backup and restore table
migrate_table() {
    local table_name="$1"
    local schema_name="${2:-public}"
    
    echo "🔄 Migrating table: ${schema_name}.${table_name}"
    
    # Create backup
    echo "  📦 Creating backup..."
    PGPASSWORD="$OLD_DB_PASSWORD" pg_dump \
        -h "$OLD_DB_HOST" \
        -p "$OLD_DB_PORT" \
        -U "$OLD_DB_USER" \
        -d "$OLD_DB_NAME" \
        -t "${schema_name}.${table_name}" \
        --data-only \
        --inserts \
        -f "${BACKUP_DIR}/${table_name}.sql"
    
    # Check if table exists in new database
    if PGPASSWORD="$NEW_DB_PASSWORD" psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c "\d ${schema_name}.${table_name}" > /dev/null 2>&1; then
        echo "  ✅ Table ${schema_name}.${table_name} exists in new database"
        
        # Restore data
        echo "  📥 Restoring data..."
        PGPASSWORD="$NEW_DB_PASSWORD" psql \
            -h "$NEW_DB_HOST" \
            -p "$NEW_DB_PORT" \
            -U "$NEW_DB_USER" \
            -d "$NEW_DB_NAME" \
            -f "${BACKUP_DIR}/${table_name}.sql"
        
        echo "  ✅ Successfully migrated ${schema_name}.${table_name}"
    else
        echo "  ⚠️  Table ${schema_name}.${table_name} does not exist in new database, skipping..."
    fi
}

# Function to migrate with custom SQL
migrate_with_sql() {
    local table_name="$1"
    local sql_query="$2"
    
    echo "🔄 Migrating table with custom SQL: ${table_name}"
    
    # Export data from old database
    echo "  📦 Exporting data..."
    PGPASSWORD="$OLD_DB_PASSWORD" psql \
        -h "$OLD_DB_HOST" \
        -p "$OLD_DB_PORT" \
        -U "$OLD_DB_USER" \
        -d "$OLD_DB_NAME" \
        -c "COPY (${sql_query}) TO STDOUT WITH CSV HEADER" \
        > "${BACKUP_DIR}/${table_name}.csv"
    
    # Check if table exists in new database
    if PGPASSWORD="$NEW_DB_PASSWORD" psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c "\d ${table_name}" > /dev/null 2>&1; then
        echo "  📥 Importing data..."
        PGPASSWORD="$NEW_DB_PASSWORD" psql \
            -h "$NEW_DB_HOST" \
            -p "$NEW_DB_PORT" \
            -U "$NEW_DB_USER" \
            -d "$NEW_DB_NAME" \
            -c "\COPY ${table_name} FROM '${BACKUP_DIR}/${table_name}.csv' WITH CSV HEADER"
        
        echo "  ✅ Successfully migrated ${table_name}"
    else
        echo "  ⚠️  Table ${table_name} does not exist in new database, skipping..."
    fi
}

# Start migration process
echo "🚀 Starting data migration..."

# Core application tables (in dependency order)
echo "📊 Migrating core application tables..."

# Users and authentication
migrate_table "users" "auth"
migrate_table "spaces" "spaces"

# Transactions
migrate_table "transaction_categories" "transactions"
migrate_table "transaction_accounts" "transactions"
migrate_table "transactions" "transactions"
migrate_table "transfers" "transactions"

# Other core tables
migrate_table "budgets"
migrate_table "monthly_financial_summaries"
migrate_table "onboardings"
migrate_table "goal_descriptions"

# CRM tables
migrate_table "crm_tickets" "crm"
migrate_table "crm_ticket_responses" "crm"

# AI tables
migrate_table "ai_usages" "ai"

# User activity
migrate_table "user_activities" "user_activity"

# Special handling for tables with complex relationships
echo "🔗 Migrating tables with complex relationships..."

# Migrate space_users with custom query to handle relationships
migrate_with_sql "space_users" "SELECT * FROM spaces.space_users"

# Migrate roles and permissions
migrate_table "roles" "roles"
migrate_table "users_roles" "roles"

# Migrate any other tables that might exist
echo "🔍 Checking for additional tables..."

# Get list of all tables from old database
TABLES=$(PGPASSWORD="$OLD_DB_PASSWORD" psql \
    -h "$OLD_DB_HOST" \
    -p "$OLD_DB_PORT" \
    -U "$OLD_DB_USER" \
    -d "$OLD_DB_NAME" \
    -t -c "SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname NOT IN ('information_schema', 'pg_catalog') ORDER BY schemaname, tablename;")

# Migrate any remaining tables
while IFS= read -r table_info; do
    if [ -n "$table_info" ]; then
        table_info=$(echo "$table_info" | xargs) # trim whitespace
        schema_name=$(echo "$table_info" | cut -d'.' -f1)
        table_name=$(echo "$table_info" | cut -d'.' -f2)
        
        # Skip tables we've already migrated
        if [[ ! " users spaces transaction_categories transaction_accounts transactions transfers budgets monthly_financial_summaries onboardings goal_descriptions crm_tickets crm_ticket_responses ai_usages user_activities space_users roles users_roles " =~ " $table_name " ]]; then
            echo "🔄 Migrating additional table: ${table_info}"
            migrate_table "$table_name" "$schema_name"
        fi
    fi
done <<< "$TABLES"

# Verify migration
echo "🔍 Verifying migration..."

# Count records in key tables
echo "📊 Record counts comparison:"

key_tables=("auth.users" "spaces.spaces" "transactions.transactions" "transactions.transfers")

for table in "${key_tables[@]}"; do
    schema_name=$(echo "$table" | cut -d'.' -f1)
    table_name=$(echo "$table" | cut -d'.' -f2)
    
    old_count=$(PGPASSWORD="$OLD_DB_PASSWORD" psql -h "$OLD_DB_HOST" -p "$OLD_DB_PORT" -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -t -c "SELECT COUNT(*) FROM ${table};" | xargs)
    new_count=$(PGPASSWORD="$NEW_DB_PASSWORD" psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -t -c "SELECT COUNT(*) FROM ${table};" | xargs)
    
    echo "  ${table}: Old=${old_count}, New=${new_count}"
    
    if [ "$old_count" = "$new_count" ]; then
        echo "    ✅ Match"
    else
        echo "    ⚠️  Mismatch"
    fi
done

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf "$BACKUP_DIR"

echo "🎉 Migration completed!"
echo ""
echo "📝 Next steps:"
echo "1. Verify data integrity in the new TimescaleDB database"
echo "2. Update application configuration to use new database"
echo "3. Test application functionality"
echo "4. Update DNS/load balancer to point to new setup"
echo "5. Decommission old database after verification"
echo ""
echo "⚠️  Important: Keep the old database running until you've verified everything works correctly!"
