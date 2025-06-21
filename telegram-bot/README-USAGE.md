# MSS Downloader Telegram Bot - Usage Guide

## Overview

The Telegram bot system for MSS Downloader supports multiplatform builds and notifications.

## Architecture

### Core Bot
- **`multiplatform-bot.js`** - Main bot class supporting AMD64, ARM64, and Linux platforms
- **`bot.js`** - DEPRECATED: Old AMD64-only bot (kept for compatibility)

### Notification Scripts
- **`send-multiplatform-build.js`** - ✅ CURRENT: Send notifications for all platforms
- **`send-build.js`** - DEPRECATED: Only sends AMD64 notifications

### Support Modules
- `build-utils.js` - Build detection and validation utilities
- `file-handler.js` - File compression and delivery logic
- `github-releases.js` - GitHub release management

## Usage

### 1. Start Interactive Bot (for user interactions)
```bash
export TELEGRAM_BOT_TOKEN="your_token_here"
node start-multiplatform-bot.js
```

### 2. Send Build Notifications (automated/manual)
```bash
export TELEGRAM_BOT_TOKEN="your_token_here"
node send-multiplatform-build.js
```

### 3. Test Subscription Logic
```bash
node test-subscription-logic.js    # Check current subscriber state
node test-bot-menu.js              # Test menu functionality
```

## Platform Support

The bot supports three platforms:
- 🖥️ **Windows AMD64 (x64)** - Standard Windows builds
- 💻 **Windows ARM64** - ARM-based Windows devices
- 🐧 **Linux AppImage** - Portable Linux application

## Subscription Management

Users can:
- Subscribe to individual platforms
- Subscribe to all platforms at once
- View current subscriptions
- Unsubscribe from individual or all platforms

## File Structure

```
telegram-bot/
├── multiplatform-bot.js          # Main bot class
├── send-multiplatform-build.js   # Notification sender
├── start-multiplatform-bot.js    # Interactive bot starter
├── build-utils.js                # Build detection utilities
├── file-handler.js               # File delivery logic
├── github-releases.js            # GitHub integration
├── subscribers.json              # Subscriber database
└── test-*.js                     # Testing utilities
```

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather

## Migration Notes

**Important:** The system migrated from single-platform (AMD64) to multiplatform support. Old subscribers are automatically migrated to AMD64-only subscriptions for backward compatibility.

## Bot Commands

- `/start` - Show main menu
- `/subscribe` - Open subscription menu
- `/unsubscribe` - Open unsubscription menu  
- `/latest` - Download latest builds for subscribed platforms

## Troubleshooting

### Issue: Only receiving AMD64 builds despite subscribing to all platforms
**Solution:** Ensure `send-multiplatform-build.js` is used instead of `send-build.js`

### Issue: Menu not showing current subscriptions correctly
**Solution:** Check `subscribers.json` format - should include `platforms` array

### Issue: Bot not responding
**Solution:** Verify `TELEGRAM_BOT_TOKEN` is set and bot is running with correct script

## Development

For development and testing, use the test scripts:
```bash
node test-subscription-logic.js    # Validate subscriber data
node test-bot-menu.js              # Test menu logic
```