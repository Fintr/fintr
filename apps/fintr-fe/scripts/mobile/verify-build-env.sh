#!/bin/bash

echo "🔍 Verifying Environment Variables in Build"
echo "==========================================="
echo ""

cd "$(dirname "$0")/../.."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production not found!"
    exit 1
fi

echo "✅ .env.production exists"
echo ""

# Check if out directory exists
if [ ! -d "out" ]; then
    echo "❌ 'out' directory not found - you need to build first"
    echo "   Run: ./scripts/mobile/build-production.sh"
    exit 1
fi

echo "✅ 'out' directory exists"
echo ""

# Check for backend URL in build
BACKEND_URL=$(grep -o "NEXT_PUBLIC_BE_URL.*" .env.production | cut -d'=' -f2 | tr -d '"')
echo "Looking for backend URL: $BACKEND_URL"
echo ""

if grep -r "$BACKEND_URL" out/ 2>/dev/null | head -1 > /dev/null; then
    echo "✅ Backend URL found in build files"
    echo ""
    echo "Found in:"
    grep -r "$BACKEND_URL" out/ 2>/dev/null | head -3 | cut -d':' -f1
else
    echo "❌ Backend URL NOT found in build files!"
    echo "   This means environment variables weren't included in the build"
    echo ""
    echo "Solution:"
    echo "   1. Make sure .env.production has NEXT_PUBLIC_BE_URL"
    echo "   2. Rebuild: ./scripts/mobile/build-production.sh"
    echo "   3. Make sure environment variables are exported before pnpm build"
fi

echo ""
echo "Checking for environment variable references..."
if grep -r "process.env.NEXT_PUBLIC_BE_URL" out/ 2>/dev/null | head -1 > /dev/null; then
    echo "⚠️  Found 'process.env.NEXT_PUBLIC_BE_URL' in build (might be undefined)"
    echo "   This suggests variables weren't replaced at build time"
else
    echo "✅ No process.env references found (variables were replaced)"
fi

echo ""
echo "Checking for Auth0 domain..."
AUTH0_DOMAIN=$(grep -o "NEXT_PUBLIC_AUTH0_DOMAIN.*" .env.production | cut -d'=' -f2 | tr -d '"')
if grep -r "$AUTH0_DOMAIN" out/ 2>/dev/null | head -1 > /dev/null; then
    echo "✅ Auth0 domain found in build"
else
    echo "❌ Auth0 domain NOT found in build"
fi
