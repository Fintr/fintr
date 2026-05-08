#!/usr/bin/env bash

# workspace-setup.sh
# Copies .env files from the original repository to the current opencode workspace.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"

# Default original repo path (can be overridden with argument)
ORIGINAL_REPO="${1:-/Users/mikodagatan/Programming/fintr}"

echo "Copying .env files from: $ORIGINAL_REPO"
echo "To workspace: $WORKSPACE_ROOT"
echo ""

# Define the files to copy
declare -a FILES=(
    "apps/fintr-be/.env"
    "apps/fintr-be/.env.staging"
    "apps/fintr-be/.env.production"
    "apps/fintr-fe/.env"
    "apps/fintr-fe/.env.production"
)

# Track missing files
MISSING=()
COPIED=()

for file in "${FILES[@]}"; do
    SOURCE="$ORIGINAL_REPO/$file"
    DEST="$WORKSPACE_ROOT/$file"
    DEST_DIR="$(dirname "$DEST")"

    if [ -f "$SOURCE" ]; then
        mkdir -p "$DEST_DIR"
        cp "$SOURCE" "$DEST"
        COPIED+=("$file")
        echo "  [OK] Copied: $file"
    else
        MISSING+=("$file")
        echo "  [MISSING] $file"
    fi
done

echo ""
echo "Summary:"
echo "  Copied: ${#COPIED[@]} file(s)"
echo "  Missing: ${#MISSING[@]} file(s)"

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "Missing files:"
    for file in "${MISSING[@]}"; do
        echo "    - $file"
    done
    exit 1
fi

echo ""
echo "Workspace setup complete!"
