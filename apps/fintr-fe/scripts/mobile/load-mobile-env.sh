#!/usr/bin/env bash
# Source Capacitor / native production env (not Kamal web deploy).
# Usage: source scripts/mobile/load-mobile-env.sh

set -euo pipefail

MOBILE_ENV_FILE="${MOBILE_ENV_FILE:-.env.mobile.production}"

if [[ ! -f "$MOBILE_ENV_FILE" ]]
then
  echo "load-mobile-env: missing ${MOBILE_ENV_FILE}" >&2
  echo "  Copy .env.mobile.production.example → .env.mobile.production" >&2
  exit 1
fi

echo "Loading environment from ${MOBILE_ENV_FILE}..."
set -a
# shellcheck source=/dev/null
source "$MOBILE_ENV_FILE"
set +a
