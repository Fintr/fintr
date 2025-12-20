#!/bin/bash
# Simplified PostgreSQL initialization script for staging
# This script runs when the container starts and can access environment variables

set -e

echo "Starting PostgreSQL initialization for staging..."

# Get database name from environment variable (set by Kamal)
DB_NAME=${POSTGRES_DB:-fintr_staging}
ADMIN_USER=${POSTGRES_USER:-fintr_admin}
ADMIN_PASSWORD=${POSTGRES_PASSWORD}

echo "Database: $DB_NAME"
echo "Admin User: $ADMIN_USER"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -U $ADMIN_USER -d $DB_NAME; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "PostgreSQL is ready, starting initialization..."

# Create extensions
echo "Creating extensions..."
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vectorscale;"

# Create Rails database user
echo "Creating fintr_rails user..."
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE USER fintr_rails WITH PASSWORD '$ADMIN_PASSWORD';" || echo "User fintr_rails might already exist, continuing..."

# Grant all privileges to fintr_rails on the main database
echo "Granting permissions to fintr_rails..."
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON SCHEMA public TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SCHEMA public OWNER TO fintr_rails;"

# Grant superuser privileges to fintr_rails (this should solve the permission issue)
echo "Granting superuser privileges to fintr_rails..."
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER USER fintr_rails WITH SUPERUSER CREATEDB CREATEROLE;"

# Apply PostgreSQL configuration from postgresql.conf if it exists
if [ -f /etc/postgresql/postgresql.conf ]; then
    echo "Applying PostgreSQL configuration from /etc/postgresql/postgresql.conf..."
    
    # Extract and apply max_connections
    MAX_CONNECTIONS=$(grep -E "^[[:space:]]*max_connections[[:space:]]*=" /etc/postgresql/postgresql.conf | sed -E 's/^[[:space:]]*[^=]+=[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d "'\"")
    if [ -n "$MAX_CONNECTIONS" ]; then
        echo "Setting max_connections to $MAX_CONNECTIONS"
        psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SYSTEM SET max_connections = $MAX_CONNECTIONS;" || echo "Note: max_connections may require restart to take effect"
    fi
    
    # Extract and apply shared_buffers
    SHARED_BUFFERS=$(grep -E "^[[:space:]]*shared_buffers[[:space:]]*=" /etc/postgresql/postgresql.conf | sed -E 's/^[[:space:]]*[^=]+=[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d "'\"")
    if [ -n "$SHARED_BUFFERS" ]; then
        echo "Setting shared_buffers to $SHARED_BUFFERS"
        psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SYSTEM SET shared_buffers = '$SHARED_BUFFERS';" || echo "Note: shared_buffers may require restart to take effect"
    fi
    
    # Extract and apply work_mem
    WORK_MEM=$(grep -E "^[[:space:]]*work_mem[[:space:]]*=" /etc/postgresql/postgresql.conf | sed -E 's/^[[:space:]]*[^=]+=[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d "'\"")
    if [ -n "$WORK_MEM" ]; then
        echo "Setting work_mem to $WORK_MEM"
        psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SYSTEM SET work_mem = '$WORK_MEM';"
    fi
    
    # Extract and apply maintenance_work_mem
    MAINTENANCE_WORK_MEM=$(grep -E "^[[:space:]]*maintenance_work_mem[[:space:]]*=" /etc/postgresql/postgresql.conf | sed -E 's/^[[:space:]]*[^=]+=[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d "'\"")
    if [ -n "$MAINTENANCE_WORK_MEM" ]; then
        echo "Setting maintenance_work_mem to $MAINTENANCE_WORK_MEM"
        psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SYSTEM SET maintenance_work_mem = '$MAINTENANCE_WORK_MEM';"
    fi
    
    # Extract and apply effective_cache_size
    EFFECTIVE_CACHE_SIZE=$(grep -E "^[[:space:]]*effective_cache_size[[:space:]]*=" /etc/postgresql/postgresql.conf | sed -E 's/^[[:space:]]*[^=]+=[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d "'\"")
    if [ -n "$EFFECTIVE_CACHE_SIZE" ]; then
        echo "Setting effective_cache_size to $EFFECTIVE_CACHE_SIZE"
        psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SYSTEM SET effective_cache_size = '$EFFECTIVE_CACHE_SIZE';"
    fi
    
    echo "Configuration applied. Settings written to postgresql.auto.conf (auto-loaded on restart)"
else
    echo "Warning: /etc/postgresql/postgresql.conf not found, skipping configuration application"
fi

echo "PostgreSQL initialization completed successfully!"
