# MSS Downloader Telegram Bot

A Telegram bot for sending build notifications to subscribers when new Windows AMD64 builds are available.

## Features

- 📱 **Subscription Management**: Users can subscribe/unsubscribe to notifications
- 🚀 **Build Notifications**: Automatically sends new builds to subscribers  
- 📦 **File Sharing**: Sends build files directly (up to 50MB) or provides download instructions
- 👥 **User Management**: Tracks subscribers and handles blocked users automatically
- 🔧 **Manual Triggers**: Send builds or custom messages on demand

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Choose a name and username for your bot
4. Save the bot token provided

### 2. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 3. Set Environment Variable

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
```

Or create a `.env` file:
```bash
echo "TELEGRAM_BOT_TOKEN=your_bot_token_here" > .env
```

### 4. Start the Bot

```bash
npm start
```

## Usage

### Bot Commands (for users)

- `/start` - Welcome message and command list
- `/subscribe` - Subscribe to build notifications
- `/unsubscribe` - Unsubscribe from notifications  
- `/status` - Check subscription status and subscriber count
- `/latest` - Get current version information

### Sending Builds (for developers)

```bash
# Build the application first
npm run dist

# Send the latest build to all subscribers
node telegram-bot/send-build.js

# Send a custom message (no file)
node telegram-bot/send-build.js --message "Custom announcement"
```

### Integration with Build Process

Add to your build script or CI/CD pipeline:

```bash
# In package.json scripts
"build-and-notify": "npm run dist && node telegram-bot/send-build.js"

# Or in GitHub Actions
- name: Notify Telegram subscribers
  run: node telegram-bot/send-build.js
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

## File Structure

```
telegram-bot/
├── bot.js              # Main bot implementation
├── send-build.js       # Build notification script
├── package.json        # Dependencies and scripts
├── subscribers.json    # Subscriber data (auto-created)
└── README.md          # This file
```

## Configuration

### Environment Variables

- `TELEGRAM_BOT_TOKEN` - Required. Your bot token from BotFather

### File Size Limits

- Files up to 50MB are sent directly via Telegram
- Larger files receive a message with download instructions
- Automatically detects and handles file sizes

### Subscriber Management

- Subscribers are stored in `subscribers.json`
- Blocked users are automatically removed from the list
- No manual database management required

## Development

### Run in Development Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing

1. Start the bot: `npm start`
2. Message your bot on Telegram
3. Test commands: `/subscribe`, `/status`, etc.
4. Test build sending: `node send-build.js --message "Test message"`

## Troubleshooting

### Common Issues

**Bot not responding:**
- Check that `TELEGRAM_BOT_TOKEN` is set correctly
- Verify the bot is running: `npm start`
- Check console for error messages

**No builds found:**
- Run `npm run dist` first to create Windows builds
- Check that `dist/` folder contains `.exe`, `.zip`, or `.msi` files

**Permission denied:**
- Make send-build.js executable: `chmod +x send-build.js`
- Check file paths are correct

### Debug Mode

Add debug logging to bot.js:
```javascript
process.env.DEBUG = 'telegram-bot';
```

## Security Notes

- Keep your bot token secure and never commit it to version control
- The bot automatically removes blocked/inactive subscribers
- Subscriber data is stored locally in JSON format
- No sensitive user information is collected

## License

MIT License - Same as the main MSS Downloader project