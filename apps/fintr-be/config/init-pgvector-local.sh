#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
until pg_isready -U fintr_rails -d fintr_development; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "PostgreSQL is ready. Initializing databases and users..."

# Create extensions (TimescaleDB and pgvectorscale)
psql -U fintr_rails -d fintr_development -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
# Try to create pgvectorscale extension, but don't fail if it's not available
psql -U fintr_rails -d fintr_development -c "CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;" || echo "Warning: pgvectorscale extension not available, using pgvector instead"
psql -U fintr_rails -d fintr_development -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Create additional databases for Rails multi-database setup
psql -U fintr_rails -d fintr_development -c "CREATE DATABASE fintr_test;"
psql -U fintr_rails -d fintr_development -c "CREATE DATABASE fintr_development_cache;"
psql -U fintr_rails -d fintr_development -c "CREATE DATABASE fintr_development_queue;"
psql -U fintr_rails -d fintr_development -c "CREATE DATABASE fintr_development_cable;"

# Create Rails database user with the same password as admin
psql -U fintr_rails -d fintr_development -c "CREATE USER fintr_rails WITH PASSWORD '$POSTGRES_PASSWORD';"

# Grant permissions to Rails user for all databases
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON DATABASE fintr_test TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development_cache TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development_queue TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON DATABASE fintr_development_cable TO fintr_rails;"

# Grant schema permissions
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON SCHEMA public TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO fintr_rails;"

# Set default privileges for future objects
psql -U fintr_rails -d fintr_development -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fintr_rails;"
psql -U fintr_rails -d fintr_development -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO fintr_rails;"

echo "Local PostgreSQL setup completed successfully!"
