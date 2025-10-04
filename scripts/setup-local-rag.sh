#!/bin/bash

# Local RAG Setup Script
# This script sets up the RAG system locally using Docker

set -e

echo "🚀 Setting up local RAG development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Database configuration for local Docker setup
DATABASE_PASSWORD=postgres
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Override default ports if needed
POSTGRES_PORT=5433
REDIS_PORT=6380
EOF
    echo "✅ Created .env.local file. Please update OPENAI_API_KEY with your actual key."
fi

# Database configuration is already set up in database.yml
echo "📋 Database configuration ready."

# Ensure the init script is executable
chmod +x config/init-pgvector-local.sh
echo "✅ Initialization script permissions set."

# Install gems
echo "💎 Installing gems..."
mise exec -- bundle install

# Stop any existing containers first
echo "🛑 Stopping any existing containers..."
docker-compose -f docker-compose.local.yml down -v > /dev/null 2>&1 || true

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.local.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec fintr-pgvectorscale-local pg_isready -U fintr_admin -d fintr_development > /dev/null 2>&1; do
    echo "   Still waiting..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Fix user permissions and passwords
echo "🔧 Configuring database users and permissions..."
docker exec fintr-pgvectorscale-local psql -U fintr_admin -d fintr_development -c "ALTER USER fintr_rails WITH PASSWORD 'postgres';" > /dev/null 2>&1
docker exec fintr-pgvectorscale-local psql -U fintr_admin -d fintr_development -c "ALTER USER fintr_rails CREATEDB;" > /dev/null 2>&1
docker exec fintr-pgvectorscale-local psql -U fintr_admin -d fintr_development -c "ALTER USER fintr_rails SUPERUSER;" > /dev/null 2>&1

# Grant permissions to all databases
echo "🔑 Setting up database permissions..."
for db in fintr_development fintr_development_cache fintr_development_queue fintr_development_cable fintr_test fintr_test_cache fintr_test_queue fintr_test_cable; do
    docker exec fintr-pgvectorscale-local psql -U fintr_admin -d $db -c "GRANT ALL ON SCHEMA public TO fintr_rails;" > /dev/null 2>&1 || true
done

# Create and migrate databases
echo "🗄️ Setting up databases..."
DATABASE_PASSWORD=postgres mise exec -- rails db:create
DATABASE_PASSWORD=postgres mise exec -- rails db:migrate

echo "🎉 Local RAG setup completed!"
echo ""
echo "✅ What's working:"
echo "- PostgreSQL container running on localhost:5433"
echo "- Redis container running on localhost:6380"
echo "- All databases created and migrated"
echo "- User permissions configured"
echo ""
echo "📝 Next steps:"
echo "1. Update OPENAI_API_KEY in .env.local"
echo "2. Start Rails server: mise exec -- rails server"
echo "3. Start background jobs: mise exec -- rails jobs:work"
echo "4. Test the RAG system with sample data"
echo ""
echo "🔧 Management commands:"
echo "- Stop services: docker-compose -f docker-compose.local.yml down"
echo "- Reset everything: docker-compose -f docker-compose.local.yml down -v"
echo "- View logs: docker-compose -f docker-compose.local.yml logs"
echo ""
echo "✅ RAG setup complete with TimescaleDB and pgvectorscale!"
echo "   - TimescaleDB container with pgvectorscale extension"
echo "   - HNSW vector indexes for high-performance similarity search"
echo "   - Ready for production-scale vector operations"
