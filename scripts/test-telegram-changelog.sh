#!/bin/bash

# Telegram Bot Changelog Testing Script
# This script tests changelog generation safely for evb0110 only

set -e

echo "🧪 MSS Downloader Telegram Bot - Changelog Testing"
echo "=================================================="
echo ""

# Set test environment
export NODE_ENV=development
export DEBUG=true
export TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo"

echo "🔧 Configuration:"
echo "   Environment: $NODE_ENV"
echo "   Debug Mode: $DEBUG"
echo "   Test Target: evb0110 only (admin user)"
echo ""

# Change to telegram-bot directory
cd telegram-bot

echo "🏗️  Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScript build failed"
    exit 1
fi

echo ""
echo "📊 Pre-flight Validation:"

# Get current version
CURRENT_VERSION=$(node -p "require('../package.json').version")
echo "   Package Version: v$CURRENT_VERSION"

# Check if VERSION commit exists
VERSION_COMMIT=$(git log --oneline -20 --pretty=format:"%s" | grep "^VERSION-$CURRENT_VERSION:" || echo "")
if [ -n "$VERSION_COMMIT" ]; then
    echo "   ✅ VERSION commit found: $VERSION_COMMIT"
else
    echo "   ⚠️  VERSION commit not found for v$CURRENT_VERSION"
    echo "   📝 Will test fallback changelog generation"
fi

echo ""
echo "🚀 Sending Test Changelog..."
echo "   Target: evb0110 (53582187)"
echo "   Mode: Development (admin-only notifications)"
echo ""

# Run the send-multiplatform-build script
node dist/send-multiplatform-build.js

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Test completed successfully!"
    echo "📱 Check Telegram (@evb0110) for the improved changelog message"
    echo ""
    echo "📊 Expected Improvements:"
    echo "   ✅ Version: MSS Downloader v$CURRENT_VERSION (not v1.3.36)"
    echo "   ✅ Changelog: 'Improved download reliability with real-time progress tracking'"
    echo "   ✅ Not: 'Bug fixes and stability improvements'"
else
    echo "❌ Test failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE