#!/bin/bash
set -e

# Alias kept for FIN-194 docs / muscle memory.
# Default production iOS build is now bundled-shell.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/build-production.sh" "$@"
