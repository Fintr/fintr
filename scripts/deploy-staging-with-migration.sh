#!/bin/bash

# Staging Deployment with Database Migration Script
# This script handles the complete staging deployment with TimescaleDB migration

set -e

echo "🚀 Starting staging deployment with TimescaleDB migration..."

# Check if we're in the right directory
if [ ! -f "config/deploy.staging.yml" ]; then
    echo "❌ Error: config/deploy.staging.yml not found. Please run this script from the project root."
    exit 1
fi

# Check if Kamal is available
if ! command -v kamal &> /dev/null; then
    echo "❌ Error: Kamal is not installed. Please install it first:"
    echo "  gem install kamal"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$DATABASE_PASSWORD" ]; then
    echo "❌ Error: DATABASE_PASSWORD must be set"
    echo "Usage: DATABASE_PASSWORD=your_password ./scripts/deploy-staging-with-migration.sh"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "  Environment: staging"
echo "  Database: TimescaleDB with pgvectorscale"
echo "  Host: staging-api.fintr.ai"

# Step 1: Deploy the new TimescaleDB infrastructure
echo "🏗️  Step 1: Deploying TimescaleDB infrastructure..."

# Deploy accessories first (database and redis)
echo "  📦 Deploying database and redis accessories..."
kamal accessory boot -c config/deploy.staging.yml

# Wait for database to be ready
echo "  ⏳ Waiting for TimescaleDB to be ready..."
sleep 30

# Check database health
echo "  🔍 Checking database health..."
kamal accessory details -c config/deploy.staging.yml

# Step 2: Run database migrations
echo "🗄️  Step 2: Running database migrations..."

# Deploy the application to run migrations
echo "  📦 Deploying application for migrations..."
kamal deploy -c config/deploy.staging.yml --skip-push

# Run migrations
echo "  🔄 Running database migrations..."
kamal app exec -c config/deploy.staging.yml "rails db:migrate"

# Step 3: Data migration (if old database exists)
echo "📊 Step 3: Data migration..."

# Check if old database exists and migrate data
if [ -n "$OLD_DATABASE_PASSWORD" ] && [ -n "$OLD_DATABASE_HOST" ]; then
    echo "  🔄 Migrating data from old database..."
    echo "  📝 Old DB: ${OLD_DATABASE_HOST}:${OLD_DATABASE_PORT:-5432}/${OLD_DATABASE_NAME:-fintr_staging_old}"
    echo "  📝 New DB: ${DATABASE_HOST:-staging-api.fintr.ai}:5432/fintr_staging"
    
    # Run the migration script
    ./scripts/migrate-staging-to-timescaledb.sh
else
    echo "  ⚠️  No old database configuration found. Skipping data migration."
    echo "  💡 To migrate from old database, set:"
    echo "     OLD_DATABASE_HOST, OLD_DATABASE_PASSWORD, OLD_DATABASE_NAME"
fi

# Step 4: Deploy the full application
echo "🚀 Step 4: Deploying full application..."

# Deploy the complete application
echo "  📦 Deploying application..."
kamal deploy -c config/deploy.staging.yml

# Step 5: Health checks
echo "🔍 Step 5: Running health checks..."

# Check application health
echo "  🏥 Checking application health..."
kamal app exec -c config/deploy.staging.yml "rails runner 'puts \"Application is healthy\"'"

# Check database connectivity
echo "  🗄️  Checking database connectivity..."
kamal app exec -c config/deploy.staging.yml "rails runner 'puts \"Database connection: #{ActiveRecord::Base.connection.active?}\"'"

# Check TimescaleDB extensions
echo "  🔧 Checking TimescaleDB extensions..."
kamal app exec -c config/deploy.staging.yml "rails runner 'puts \"TimescaleDB: #{ActiveRecord::Base.connection.execute(\"SELECT * FROM pg_extension WHERE extname = '\''timescaledb'\''\").any?}\"'"
kamal app exec -c config/deploy.staging.yml "rails runner 'puts \"pgvectorscale: #{ActiveRecord::Base.connection.execute(\"SELECT * FROM pg_extension WHERE extname = '\''vectorscale'\''\").any?}\"'"

# Step 6: Generate embeddings for existing data
echo "🤖 Step 6: Generating embeddings for existing data..."

# Generate embeddings for existing transactions and transfers
echo "  🔄 Generating embeddings for transactions..."
kamal app exec -c config/deploy.staging.yml "rails runner 'Ai::Operations::Embeddings::GenerateBatchEmbeddings.new.call(space_id: Spaces::Space.first.id, embeddable_type: \"Transactions::Transaction\")'"

echo "  🔄 Generating embeddings for transfers..."
kamal app exec -c config/deploy.staging.yml "rails runner 'Ai::Operations::Embeddings::GenerateBatchEmbeddings.new.call(space_id: Spaces::Space.first.id, embeddable_type: \"Transactions::Transfer\")'"

echo "🎉 Staging deployment with TimescaleDB migration completed!"
echo ""
echo "✅ What's deployed:"
echo "  - TimescaleDB with pgvectorscale extensions"
echo "  - Redis for caching and job queues"
echo "  - Rails application with RAG capabilities"
echo "  - All database migrations applied"
echo "  - Vector embeddings generated for existing data"
echo ""
echo "🔗 Access your application:"
echo "  - URL: https://staging-api.fintr.ai"
echo "  - Database: staging-api.fintr.ai:5432"
echo "  - Redis: staging-api.fintr.ai:6379"
echo ""
echo "📝 Next steps:"
echo "1. Test the application functionality"
echo "2. Verify RAG capabilities work"
echo "3. Monitor application logs: kamal app logs -c config/deploy.staging.yml"
echo "4. Check database status: kamal accessory details -c config/deploy.staging.yml"
echo ""
echo "⚠️  Important: Keep monitoring the application for the first few hours to ensure everything works correctly!"


