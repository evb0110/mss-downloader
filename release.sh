#!/bin/bash

# MSS Downloader Release Script
# Automates the version release workflow

set -e

echo "🚀 MSS Downloader Release Workflow"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: v$CURRENT_VERSION"

# Ask for changelog
echo ""
echo "📝 Enter changelog for v$CURRENT_VERSION (1-2 sentences):"
read -r CHANGELOG

if [ -z "$CHANGELOG" ]; then
    echo "❌ Error: Changelog cannot be empty"
    exit 1
fi

echo ""
echo "🔨 Building Windows AMD64 release..."
npm run dist:win

echo ""
echo "📱 Sending Telegram notification..."

# Check if bot token is set
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️  TELEGRAM_BOT_TOKEN not set. Using hardcoded token..."
    export TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo"
fi

# Create custom message with changelog
NOTIFICATION_MESSAGE="🚀 New MSS Downloader v$CURRENT_VERSION Released!

📋 Changes: $CHANGELOG

💻 Platform: Windows AMD64
📅 Released: $(date '+%Y-%m-%d %H:%M')

Download the latest build attached below!"

# Send notification
node telegram-bot/send-build.js --message "$NOTIFICATION_MESSAGE"

echo ""
echo "✅ Release workflow completed successfully!"
echo "📦 Version: v$CURRENT_VERSION"
echo "📋 Changelog: $CHANGELOG"
echo "📱 Telegram notification sent to subscribers"

# Update CLAUDE.md with version history entry
echo ""
echo "📝 Updating version history in CLAUDE.md..."

# Create backup
cp CLAUDE.md CLAUDE.md.backup

# Add new version entry (insert after "### Version History" line)
TEMP_FILE=$(mktemp)
VERSION_ENTRY="- **v$CURRENT_VERSION:** $CHANGELOG"

awk -v entry="$VERSION_ENTRY" '
/^### Version History/ {
    print $0
    print entry
    next
}
{print}
' CLAUDE.md > "$TEMP_FILE" && mv "$TEMP_FILE" CLAUDE.md

echo "✅ Version history updated in CLAUDE.md"
echo ""
echo "🎉 Release v$CURRENT_VERSION is now complete and deployed!"