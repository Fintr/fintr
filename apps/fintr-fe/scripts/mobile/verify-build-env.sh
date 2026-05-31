#!/bin/bash
# Verify mobile production environment before building

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(cd "$SCRIPT_DIR/../.." && pwd)"

MOBILE_ENV_FILE=".env.mobile.production"

if [ ! -f "$MOBILE_ENV_FILE" ]; then
    echo "❌ ${MOBILE_ENV_FILE} not found!"
    echo "   Copy .env.mobile.production.example → .env.mobile.production"
    exit 1
fi

echo "✅ ${MOBILE_ENV_FILE} exists"
echo ""

BACKEND_URL=$(grep -E "^NEXT_PUBLIC_BE_URL=" "$MOBILE_ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$BACKEND_URL" ]; then
    echo "❌ NEXT_PUBLIC_BE_URL is not set in ${MOBILE_ENV_FILE}"
    exit 1
fi

echo "✅ NEXT_PUBLIC_BE_URL=${BACKEND_URL}"
echo ""

if [[ "$BACKEND_URL" == *"localhost"* ]] || [[ "$BACKEND_URL" == *"127.0.0.1"* ]]; then
    echo "⚠️  Warning: Backend URL points to localhost"
    echo "   For production mobile builds, use https://api.fintr.ai"
    echo ""
fi

AUTH0_DOMAIN=$(grep -E "^NEXT_PUBLIC_AUTH0_DOMAIN=" "$MOBILE_ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$AUTH0_DOMAIN" ]; then
    echo "❌ NEXT_PUBLIC_AUTH0_DOMAIN is not set"
    exit 1
fi

echo "✅ NEXT_PUBLIC_AUTH0_DOMAIN=${AUTH0_DOMAIN}"
echo ""
echo "✅ Mobile production environment looks good"
