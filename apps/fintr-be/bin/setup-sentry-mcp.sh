#!/bin/bash

# Setup script for Sentry MCP integration
# This script prepares your environment for using Sentry MCP with Cursor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Setting up Sentry MCP for fintr-be..."
echo ""

# Check if mise is installed
if ! command -v mise &> /dev/null; then
  echo "⚠️  mise is not installed. Installing mise..."
  echo "   Please visit: https://mise.jdx.dev/getting-started.html"
  echo "   Or install via: curl https://mise.run | sh"
  echo ""
  read -p "Press Enter after installing mise, or Ctrl+C to cancel..."
fi

# Ensure Node.js 25.2.1 is in .tool-versions
cd "$PROJECT_ROOT"

if [ -f ".tool-versions" ]; then
  if ! grep -q "nodejs" .tool-versions; then
    echo "📝 Adding Node.js 25.2.1 to .tool-versions..."
    echo "nodejs 25.2.1" >> .tool-versions
  else
    echo "✅ Node.js already specified in .tool-versions"
  fi
else
  echo "📝 Creating .tool-versions with Node.js 25.2.1..."
  echo "nodejs 25.2.1" > .tool-versions
fi

# Install Node.js via mise
if command -v mise &> /dev/null; then
  echo "📦 Installing Node.js 25.2.1 via mise..."
  mise install nodejs@25.2.1 || {
    echo "⚠️  Failed to install Node.js via mise. Please install manually."
    exit 1
  }
  echo "✅ Node.js installed"
else
  echo "⚠️  mise not found. Please ensure Node.js v20+ is installed."
  echo "   You can install it via: https://nodejs.org/"
fi

# Verify Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js v20+ is required. You have $(node -v)"
    echo "   Please install Node.js v20 or higher"
    exit 1
  else
    echo "✅ Node.js $(node -v) is installed"
  fi
else
  echo "❌ Node.js is not in PATH. Please ensure Node.js is installed and in your PATH."
  exit 1
fi

# Ensure wrapper script is executable
WRAPPER_SCRIPT="$PROJECT_ROOT/bin/sentry-mcp-wrapper.sh"
if [ -f "$WRAPPER_SCRIPT" ]; then
  chmod +x "$WRAPPER_SCRIPT"
  echo "✅ Wrapper script is executable"
else
  echo "❌ Wrapper script not found at $WRAPPER_SCRIPT"
  exit 1
fi

# Check for .env file
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "📝 Creating .env file..."
  touch "$ENV_FILE"
  echo "   Please add your SENTRY_ACCESS_TOKEN to .env"
fi

# Check if SENTRY_ACCESS_TOKEN is in .env
if grep -q "SENTRY_ACCESS_TOKEN" "$ENV_FILE" 2>/dev/null; then
  echo "✅ SENTRY_ACCESS_TOKEN found in .env"
else
  echo "⚠️  SENTRY_ACCESS_TOKEN not found in .env"
  echo ""
  echo "   Please add the following to your .env file:"
  echo "   SENTRY_ACCESS_TOKEN=your-sentry-access-token-here"
  echo ""
  echo "   To get your access token:"
  echo "   1. Go to https://sentry.io/settings/account/api/auth-tokens/"
  echo "   2. Create a new token with the following scopes:"
  echo "      - org:read"
  echo "      - project:read"
  echo "      - project:write"
  echo "      - team:read"
  echo "      - team:write"
  echo "      - event:read"
  echo "      - event:write"
  echo ""
fi

# MCP Configuration
MCP_CONFIG_FILE="$HOME/.cursor/mcp.json"
echo ""
echo "📋 Cursor MCP Configuration"
echo ""

if [ -f "$MCP_CONFIG_FILE" ]; then
  if grep -q "sentry-fintr" "$MCP_CONFIG_FILE" 2>/dev/null; then
    echo "✅ sentry-fintr already configured in Cursor MCP settings"
  else
    echo "⚠️  sentry-fintr not found in Cursor MCP settings"
    echo ""
    echo "   Please add the following to $MCP_CONFIG_FILE:"
    echo ""
    echo "   {"
    echo "     \"mcpServers\": {"
    echo "       \"sentry-fintr\": {"
    echo "         \"command\": \"$PROJECT_ROOT/bin/sentry-mcp-wrapper.sh\","
    echo "         \"cwd\": \"$PROJECT_ROOT\""
    echo "       }"
    echo "     }"
    echo "   }"
    echo ""
  fi
else
  echo "⚠️  Cursor MCP config file not found"
  echo ""
  echo "   Please create $MCP_CONFIG_FILE with:"
  echo ""
  echo "   {"
  echo "     \"mcpServers\": {"
  echo "       \"sentry-fintr\": {"
  echo "         \"command\": \"$PROJECT_ROOT/bin/sentry-mcp-wrapper.sh\","
  echo "         \"cwd\": \"$PROJECT_ROOT\""
  echo "       }"
  echo "     }"
  echo "   }"
  echo ""
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure SENTRY_ACCESS_TOKEN is in your .env file"
echo "2. Configure Cursor MCP settings (see above)"
echo "3. Restart Cursor to load the MCP server"
echo ""
echo "After restarting, you can ask the AI assistant:"
echo "  - 'Show me unresolved issues from the last week'"
echo "  - 'What errors occurred today?'"
echo "  - 'Analyze issue PROJECT-123'"
echo ""

