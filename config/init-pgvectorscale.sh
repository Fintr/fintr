#!/bin/bash
# PostgreSQL initialization script for pgvectorscale
# This script runs when the container starts and can access environment variables

set -e

# Wait for PostgreSQL to be ready
until pg_isready -U fintr_admin -d fintr_production; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Create extensions
psql -U fintr_admin -d fintr_production -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U fintr_admin -d fintr_production -c "CREATE EXTENSION IF NOT EXISTS vectorscale;"

# Create additional databases
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_development;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_test;"

# Create production databases
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_production_cache;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_production_queue;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_production_cable;"

# Create staging databases
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_staging;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_staging_cache;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_staging_queue;"
psql -U fintr_admin -d fintr_production -c "CREATE DATABASE fintr_staging_cable;"

# Grant permissions to admin user
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_test TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_cache TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_queue TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_cable TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cache TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_queue TO fintr_admin;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cable TO fintr_admin;"

# Create Rails database user with the same password as admin
# Use the POSTGRES_PASSWORD environment variable
psql -U fintr_admin -d fintr_production -c "CREATE USER fintr_rails WITH PASSWORD '$POSTGRES_PASSWORD';"

# Grant permissions to Rails user
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_test TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_cache TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_queue TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_production_cable TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cache TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_queue TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON DATABASE fintr_staging_cable TO fintr_rails;"

# Grant schema permissions
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON SCHEMA public TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO fintr_rails;"

# Set default privileges for future objects
psql -U fintr_admin -d fintr_production -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fintr_rails;"
psql -U fintr_admin -d fintr_production -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO fintr_rails;"

echo "PostgreSQL initialization completed successfully!"
