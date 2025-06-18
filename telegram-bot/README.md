# MSS Downloader Telegram Bot

Telegram bot for automatic Windows AMD64 build notifications with GitHub Releases integration.

## Features

- ✅ **Single EXE delivery** - No splitting, no compression artifacts
- 🚀 **GitHub Releases integration** - Permanent download links
- 📦 **2-release limit** - Automatic cleanup of old releases
- 🔔 **Smart notifications** - Only for AMD64 builds
- 🤖 **Streamlined interface** - Subscribe/Latest Build only

## Prerequisites

1. **GitHub CLI** installed and authenticated:
   ```bash
   # Install GitHub CLI (macOS)
   brew install gh
   
   # Authenticate
   gh auth login
   ```

2. **Telegram Bot Token**:
   - Create bot with [@BotFather](https://t.me/botfather)
   - Copy the token

## Setup

1. **Install dependencies**:
   ```bash
   cd telegram-bot
   npm install
   ```

2. **Set environment variable**:
   ```bash
   export TELEGRAM_BOT_TOKEN="your_bot_token_here"
   ```

3. **Test GitHub integration**:
   ```bash
   gh auth status
   ```

## Usage

### Start the bot:
```bash
npm run start
```

### Send build notification:
```bash
# Build first
npm run dist:win

# Send to subscribers
npm run send-build
```

### Bot Commands:
- `/start` - Show main menu
- `/subscribe` - Get build notifications
- `/unsubscribe` - Stop notifications  
- `/latest` - Download latest build

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

### Large File Handling

**Smart Processing Pipeline:**
1. **Direct Send** (≤50MB) - Files sent immediately
2. **Cloud Upload** (>50MB) - Upload to cloud storage, share direct download link  
3. **Binary Splitting** (fallback) - Split original EXE into binary parts with auto-recombination script
4. **User Instructions** - Clear guidance for each method

**User Experience:**
- **Files ≤50MB**: Instant download
- **Large files (cloud)**: Direct download link to original EXE file
- **Large files (split)**: Binary parts + automatic combination script
- **No ZIP files**: Users always get the original EXE

**Technical Details:**
- **Cloud services**: transfer.sh, file.io (30-second timeout each)
- **Binary splitting**: 45MB chunks with Windows batch recombination script
- **Smart fallback**: Cloud upload → Binary splitting → Error message
- **Automatic cleanup**: All temporary files removed after delivery

**Binary Splitting Features:**
- Original EXE split into parts (no compression)
- Windows batch script for automatic recombination
- Simple `copy /b` command to rebuild original file
- Automatic cleanup after successful combination

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