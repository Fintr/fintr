#!/bin/bash
set -e

echo "🚀 Development Mode - iOS Simulator with Live Reload"
echo "====================================================="
echo ""
echo "This script will:"
echo "  1. Set up environment for local development"
echo "  2. Sync to Capacitor"
echo "  3. Run on iOS simulator (loads from dev server)"
echo ""
echo "⚠️  Prerequisites:"
echo "  - Rails server running: rails server (localhost:3000)"
echo "  - Next.js dev server running: pnpm dev (localhost:5173)"
echo ""

# Step 1: Set up environment for DEVELOPMENT (following README.md)
echo "⚙️  Step 1: Setting up development environment..."

# For iOS Simulator, localhost works because it shares localhost with the Mac
echo "🔧 Setting up development URLs (localhost)..."
export CAPACITOR_SERVER_URL="http://localhost:5173"     # Dev server for live reload
export NEXT_PUBLIC_BE_URL="http://localhost:3000"       # Local Rails backend
export NEXT_PUBLIC_APP_BASE_URL="https://www.fintr.ai"  # Production URL for Auth0 callbacks

echo "📝 Environment configuration:"
echo "  - CAPACITOR_SERVER_URL: ${CAPACITOR_SERVER_URL}"
echo "  - NEXT_PUBLIC_BE_URL: ${NEXT_PUBLIC_BE_URL}"
echo "  - NEXT_PUBLIC_APP_BASE_URL: ${NEXT_PUBLIC_APP_BASE_URL}"
echo "✅ Environment configured"
echo ""

# Step 2: Check if dev server is running
echo "🔍 Step 2: Checking if dev server is running..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Dev server is running at http://localhost:5173"
else
    echo "⚠️  WARNING: Dev server is NOT running at http://localhost:5173"
    echo ""
    echo "Please start the dev server in another terminal:"
    echo "  pnpm dev"
    echo ""
    read -p "Press Enter once the dev server is running, or Ctrl+C to cancel..."
fi
echo ""

# Step 3: Check if Rails server is running
echo "🔍 Step 3: Checking if Rails server is running..."
if curl -s http://localhost:3000/api/v1/auth/private > /dev/null 2>&1; then
    echo "✅ Rails server is running at http://localhost:3000"
else
    echo "⚠️  WARNING: Rails server is NOT running at http://localhost:3000"
    echo ""
    echo "Please start the Rails server in another terminal:"
    echo "  cd fintr-be && rails server"
    echo ""
    read -p "Press Enter once the Rails server is running, or Ctrl+C to cancel..."
fi
echo ""

# Step 4: Sync to Capacitor
echo "🔄 Step 4: Syncing to Capacitor iOS..."
npx cap sync ios
echo "✅ Capacitor sync complete"
echo ""

# Step 5: Verify configuration
echo "🔍 Step 5: Verifying Capacitor configuration..."
if [ -f ios/App/App/capacitor.config.json ]; then
    echo "Found iOS Capacitor config:"
    cat ios/App/App/capacitor.config.json | grep -A 2 "server" || echo "No server configuration found"
fi
echo ""

# Step 6: Run on iOS simulator
echo "🚀 Step 6: Running on iOS simulator..."
echo "The app will load from: ${CAPACITOR_SERVER_URL}"
echo "Backend API calls will go to: ${NEXT_PUBLIC_BE_URL}"
echo ""
npx cap run ios

echo ""
echo "✅ Development mode running!"
echo ""
echo "📱 The app is now running on the iOS simulator"
echo "🔗 App loads from: ${CAPACITOR_SERVER_URL} (live reload enabled)"
echo "🔗 Backend URL: ${NEXT_PUBLIC_BE_URL}"
echo ""
