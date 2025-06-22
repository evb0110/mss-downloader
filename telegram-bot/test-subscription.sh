#!/bin/bash

echo "🤖 Starting Telegram bot to test subscription functionality..."

# Start bot in background
TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo" npm run start &
BOT_PID=$!

echo "🔄 Bot started with PID: $BOT_PID"
echo "📱 The bot is now running and listening for commands"
echo "💡 Try sending '/start' to the bot to test subscription buttons"
echo "🛑 Press Ctrl+C to stop the bot"

# Wait for Ctrl+C
trap "echo '🛑 Stopping bot...'; kill $BOT_PID; exit 0" INT
wait $BOT_PID