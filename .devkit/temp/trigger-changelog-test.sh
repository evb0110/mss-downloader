#!/bin/bash

# Script to trigger Telegram bot changelog test for evb0110 only
# This tests the new comprehensive changelog generation system

echo "🧪 Testing Telegram bot changelog generation for evb0110 only..."
echo "This will use the actual git commit parsing and semantic analysis"
echo ""

# Set development mode to ensure only evb0110 gets the message
export NODE_ENV=development
export DEBUG=true

# Change to telegram-bot directory
cd telegram-bot

echo "🔧 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScript build failed"
    exit 1
fi

echo ""
echo "📤 Sending changelog test message..."
echo "In development mode, this only sends to evb0110 (admin user)"
echo ""

# Run the send-multiplatform-build script
# This will use our new comprehensive changelog generation
node dist/send-multiplatform-build.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Changelog test sent successfully!"
    echo "📱 Check your Telegram (@evb0110) for the new semantic changelog format"
    echo "📊 This used actual git commit parsing with library mappings"
else
    echo ""
    echo "❌ Failed to send changelog test"
    echo "💡 Make sure TELEGRAM_BOT_TOKEN environment variable is set"
fi