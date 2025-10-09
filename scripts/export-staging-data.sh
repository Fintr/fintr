#!/bin/bash

# Export Staging Data Script
# This script exports data from the old staging database for migration

set -e

echo "📦 Exporting staging data for TimescaleDB migration..."

# Configuration
DB_HOST="${DATABASE_HOST:-staging-api.fintr.ai}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-fintr_staging_old}"
DB_USER="${DATABASE_USER:-fintr_rails}"
DB_PASSWORD="${DATABASE_PASSWORD}"

# Check if required environment variables are set
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: DATABASE_PASSWORD must be set"
    echo "Usage: DATABASE_PASSWORD=your_password ./scripts/export-staging-data.sh"
    exit 1
fi

# Create export directory
EXPORT_DIR="/tmp/fintr_staging_export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"
echo "📁 Created export directory: $EXPORT_DIR"

# Test database connection
echo "🔍 Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo "❌ Cannot connect to database. Please check your DATABASE_* environment variables."
    exit 1
fi
echo "✅ Database connection successful!"

# Export schema
echo "📋 Exporting database schema..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "${EXPORT_DIR}/schema.sql"

# Export data for each table
echo "📊 Exporting table data..."

# Core tables
tables=(
    "auth.users"
    "spaces.spaces"
    "spaces.space_users"
    "transactions.transaction_categories"
    "transactions.transaction_accounts"
    "transactions.transactions"
    "transactions.transfers"
    "budgets"
    "monthly_financial_summaries"
    "onboardings"
    "goal_descriptions"
    "crm.crm_tickets"
    "crm.crm_ticket_responses"
    "ai.ai_usages"
    "user_activity.user_activities"
    "roles.roles"
    "roles.users_roles"
)

for table in "${tables[@]}"; do
    echo "  📦 Exporting ${table}..."
    
    # Extract schema and table name
    if [[ "$table" == *"."* ]]; then
        schema_name=$(echo "$table" | cut -d'.' -f1)
        table_name=$(echo "$table" | cut -d'.' -f2)
        full_table_name="${schema_name}.${table_name}"
    else
        schema_name="public"
        table_name="$table"
        full_table_name="$table"
    fi
    
    # Check if table exists
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d ${full_table_name}" > /dev/null 2>&1; then
        # Export table data
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t "${full_table_name}" \
            --data-only \
            --inserts \
            -f "${EXPORT_DIR}/${table_name}.sql"
        
        # Also export as CSV for easier import
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "COPY ${full_table_name} TO STDOUT WITH CSV HEADER" \
            > "${EXPORT_DIR}/${table_name}.csv"
        
        echo "    ✅ Exported ${full_table_name}"
    else
        echo "    ⚠️  Table ${full_table_name} does not exist, skipping..."
    fi
done

# Create import script
echo "📝 Creating import script..."
cat > "${EXPORT_DIR}/import_to_timescaledb.sh" << 'EOF'
#!/bin/bash

# Import script for TimescaleDB
# This script imports the exported data into the new TimescaleDB database

set -e

NEW_DB_HOST="${NEW_DATABASE_HOST:-staging-api.fintr.ai}"
NEW_DB_PORT="${NEW_DATABASE_PORT:-5432}"
NEW_DB_NAME="${NEW_DATABASE_NAME:-fintr_staging}"
NEW_DB_USER="${NEW_DATABASE_USER:-fintr_rails}"
NEW_DB_PASSWORD="${NEW_DATABASE_PASSWORD}"

if [ -z "$NEW_DB_PASSWORD" ]; then
    echo "❌ Error: NEW_DATABASE_PASSWORD must be set"
    exit 1
fi

echo "📥 Importing data to TimescaleDB..."

# Import schema first
echo "📋 Importing schema..."
PGPASSWORD="$NEW_DB_PASSWORD" psql \
    -h "$NEW_DB_HOST" \
    -p "$NEW_DB_PORT" \
    -U "$NEW_DB_USER" \
    -d "$NEW_DB_NAME" \
    -f schema.sql

# Import data files
for file in *.sql; do
    if [ "$file" != "schema.sql" ] && [ "$file" != "import_to_timescaledb.sh" ]; then
        table_name=$(basename "$file" .sql)
        echo "📦 Importing ${table_name}..."
        
        PGPASSWORD="$NEW_DB_PASSWORD" psql \
            -h "$NEW_DB_HOST" \
            -p "$NEW_DB_PORT" \
            -U "$NEW_DB_USER" \
            -d "$NEW_DB_NAME" \
            -f "$file"
    fi
done

echo "✅ Import completed!"
EOF

chmod +x "${EXPORT_DIR}/import_to_timescaledb.sh"

# Create summary
echo "📊 Creating export summary..."
cat > "${EXPORT_DIR}/export_summary.txt" << EOF
Fintr Staging Data Export Summary
Generated: $(date)
Source: ${DB_HOST}:${DB_PORT}/${DB_NAME}

Exported Tables:
$(ls -la *.sql | grep -v schema.sql | awk '{print "  - " $9}')

Files:
$(ls -la)

To import to TimescaleDB:
1. Copy this directory to your deployment server
2. Set NEW_DATABASE_PASSWORD environment variable
3. Run: ./import_to_timescaledb.sh

Note: Make sure the new TimescaleDB database is running and accessible.
EOF

echo "🎉 Data export completed!"
echo ""
echo "📁 Export location: $EXPORT_DIR"
echo "📋 Files created:"
ls -la "$EXPORT_DIR"
echo ""
echo "📝 To import to TimescaleDB:"
echo "1. Copy the export directory to your deployment server"
echo "2. Set NEW_DATABASE_PASSWORD environment variable"
echo "3. Run: cd $EXPORT_DIR && ./import_to_timescaledb.sh"
echo ""
echo "⚠️  Important: Keep this export safe until you've verified the migration works correctly!"
