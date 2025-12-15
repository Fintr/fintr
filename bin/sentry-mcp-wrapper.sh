#!/bin/bash

# Wrapper script to load .env and run Sentry MCP server
# This ensures the SENTRY_ACCESS_TOKEN is loaded from .env
# Also ensures the latest Node.js version (v20+) is used via mise

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Try to use the latest Node.js via mise if available
if command -v mise &> /dev/null; then
  # mise automatically activates when in a directory with .tool-versions
  # Ensure mise is in PATH and activate it
  export PATH="$HOME/.local/bin:$PATH"
  # Use mise to ensure latest Node.js is available (from .tool-versions)
  eval "$(mise activate bash)" 2>/dev/null || eval "$(mise activate zsh)" 2>/dev/null || true
  # Change to project directory to activate .tool-versions
  cd "$PROJECT_ROOT"
  # mise will automatically use the version specified in .tool-versions
  # If Node.js is not in .tool-versions, mise will use system Node.js
fi

# Load .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  # Source the .env file properly
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Use the token from environment
TOKEN="${SENTRY_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "Error: SENTRY_ACCESS_TOKEN not found in .env file or environment" >&2
  echo "Please add SENTRY_ACCESS_TOKEN=your-token to your .env file" >&2
  exit 1
fi

# Verify Node.js is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed or not in PATH" >&2
  if command -v mise &> /dev/null; then
    echo "Please run: mise install node@20" >&2
  else
    echo "Please install Node.js v20 or higher" >&2
  fi
  exit 1
fi

# Verify Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js v20 or higher is required. You have $(node -v)" >&2
  if command -v mise &> /dev/null; then
    echo "Please run: mise install nodejs@25.2.1" >&2
    echo "Or ensure .tool-versions contains: nodejs 25.2.1" >&2
  else
    echo "Please install Node.js v20 or higher" >&2
  fi
  exit 1
fi

# Run the MCP server with the token using npx
# Use --force to handle any npx cache conflicts
# Clear any problematic npx cache entries if they exist
if [ -d "$HOME/.npm/_npx" ]; then
  # Try to clean up any corrupted npx cache (non-blocking)
  find "$HOME/.npm/_npx" -name "*sentry*" -type d -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
fi

# Run the MCP server with the access token as a CLI argument
exec npx --yes --force @sentry/mcp-server@latest --access-token="$TOKEN"


