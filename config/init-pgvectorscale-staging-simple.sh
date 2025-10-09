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

echo "PostgreSQL initialization completed successfully for staging!"
