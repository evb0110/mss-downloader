#!/bin/bash

echo "🔧 Cleaning up and restarting Telegram bot"
echo "==========================================="

echo "1. Killing all existing bot processes..."
pkill -f "telegram-bot" 2>/dev/null || echo "   No existing bot processes found"
pkill -f "node.*bot" 2>/dev/null || echo "   No node bot processes found"

echo ""
echo "2. Waiting for processes to terminate..."
sleep 2

echo ""
echo "3. Starting fresh multiplatform bot..."
echo "   Bot features:"
echo "   🖥️  Windows AMD64 support"
echo "   💻 Windows ARM64 support" 
echo "   🐧 Linux AppImage support"
echo "   📱 Hierarchical menu system"
echo ""

export TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo"

echo "Starting bot in 3 seconds..."
echo "Press Ctrl+C to stop the bot when you're done testing."
echo ""
sleep 3

node start-multiplatform-bot.js