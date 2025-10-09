#!/bin/bash
# PostgreSQL initialization script for pgvectorscale - STAGING VERSION
# This script runs when the container starts and can access environment variables

set -e

# Get database name from environment variable (set by Kamal)
DB_NAME=${POSTGRES_DB:-fintr_staging}
ADMIN_USER=${POSTGRES_USER:-fintr_admin}
ADMIN_PASSWORD=${POSTGRES_PASSWORD}

echo "Starting PostgreSQL initialization for staging..."
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
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vectorscale;"

# Create additional databases for staging
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE DATABASE fintr_development;"
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE DATABASE fintr_test;"

# Create staging databases
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE DATABASE fintr_staging_cache;"
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE DATABASE fintr_staging_queue;"
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE DATABASE fintr_staging_cable;"

# Grant permissions to admin user
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development TO $ADMIN_USER;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_test TO $ADMIN_USER;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cache TO $ADMIN_USER;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_queue TO $ADMIN_USER;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cable TO $ADMIN_USER;"

# Create Rails database user with the same password as admin
echo "Creating fintr_rails user..."
psql -U $ADMIN_USER -d $DB_NAME -c "CREATE USER fintr_rails WITH PASSWORD '$ADMIN_PASSWORD';" || echo "User fintr_rails might already exist, continuing..."

# Grant permissions to Rails user
echo "Granting database permissions to fintr_rails..."
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_test TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cache TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_queue TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cable TO fintr_rails;"

# Grant schema permissions
echo "Granting schema permissions to fintr_rails..."
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON SCHEMA public TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO fintr_rails;"

# Set default privileges for future objects
echo "Setting default privileges for fintr_rails..."
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fintr_rails;"
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO fintr_rails;"

# Make fintr_rails the owner of the public schema
echo "Making fintr_rails owner of public schema..."
psql -U $ADMIN_USER -d $DB_NAME -c "ALTER SCHEMA public OWNER TO fintr_rails;"

echo "PostgreSQL initialization completed successfully for staging!"
