# MSS Downloader Telegram Bot (TypeScript)

A modern TypeScript-based Telegram bot for sending build notifications for the MSS Downloader application.

## Features

- **TypeScript & ES Modules**: Modern JavaScript development with full type safety
- **Multi-platform Support**: Supports Windows AMD64, ARM64, and Linux builds
- **Comprehensive Testing**: Full test suite with Node.js built-in test runner
- **Subscriber Management**: Advanced subscription system with platform-specific notifications
- **File Delivery**: Smart file handling with multiple delivery methods
- **Admin Notifications**: Real-time admin alerts for new subscriptions/unsubscriptions

## Prerequisites

- Node.js 18+ (for ES modules and built-in test runner)
- TELEGRAM_BOT_TOKEN environment variable
- Build files in the `../release` directory

## Installation

```bash
npm install
npm run build
```

## Usage

### Start the Bot
```bash
npm run start
# or for development with auto-rebuild
npm run dev
```

### Send Build Notifications
```bash
# Send notifications for all available platforms
npm run send-multiplatform-build

# Environment variable required
TELEGRAM_BOT_TOKEN="your_token_here" npm run send-multiplatform-build
```

### Run Tests
```bash
npm run test
```

## Project Structure

```
src/
├── types.ts                    # TypeScript interfaces and types
├── build-utils.ts             # Build detection and validation utilities
├── multiplatform-bot.ts       # Main bot implementation
├── send-multiplatform-build.ts # Build notification script
├── bot.ts                     # Bot entry point
└── bot.test.ts               # Comprehensive test suite

dist/                          # Compiled JavaScript (generated)
├── types.js
├── build-utils.js
├── multiplatform-bot.js
├── send-multiplatform-build.js
├── bot.js
└── bot.test.js
```

## Configuration

### Environment Variables
- `TELEGRAM_BOT_TOKEN`: Required. Your Telegram bot token from @BotFather

### Bot Commands
- `/start` - Welcome message and main menu
- `/subscribe` - Subscribe to platform notifications
- `/unsubscribe` - Unsubscribe from notifications
- `/latest` - Get latest builds for all platforms
- `/test_admin` - Admin-only test command

## Development

### Building
```bash
npm run build        # Compile TypeScript to JavaScript
npm run clean        # Remove compiled files
```

### Testing
The project includes comprehensive tests covering:
- Build utilities and file detection
- Subscriber management
- Error handling
- URL validation
- Integration workflows

```bash
npm run test         # Run all tests
```

### Development Workflow
```bash
npm run dev          # Start with file watching and auto-restart
```

## Migration from JavaScript

This TypeScript version maintains full compatibility with the original JavaScript bot while providing:

1. **Type Safety**: Compile-time error detection
2. **Modern ES Modules**: Better tree-shaking and module resolution
3. **Enhanced Testing**: Comprehensive test coverage
4. **Better Documentation**: IntelliSense and type hints
5. **Maintainability**: Clearer code structure and interfaces

### Key Improvements

- **Subscriber Type Safety**: Strongly typed subscriber objects and platform enums
- **Build Detection**: Improved build file detection with proper typing
- **Error Handling**: Better error types and handling
- **Message Formatting**: Template literal support for cleaner string formatting
- **Testing**: Full test coverage with Node.js built-in test runner

## Integration

### Main Project Scripts
The main project includes these updated scripts:
```bash
npm run telegram:start           # Start the bot
npm run telegram:send-multiplatform # Send notifications
npm run telegram:test            # Run bot tests
```

### Automated Builds
The bot integrates with GitHub Actions for automated build notifications when new versions are released.

## API Reference

### MultiplatformMSSBot Class

```typescript
class MultiplatformMSSBot {
  constructor()                                           // Initialize bot
  start(): void                                          // Start polling
  notifySubscribers(message: string, builds: Builds): Promise<void> // Send notifications
}
```

### BuildUtils Class

```typescript
class BuildUtils {
  static findLatestBuilds(version?: string): BuildsData           // Find all platform builds
  static findSinglePlatformBuild(platform: Platform): BuildResult // Find specific platform
  static validateDownloadUrl(url: string): ValidationResult       // Validate GitHub URLs
}
```

### Types

```typescript
type Platform = 'amd64' | 'arm64' | 'linux'

interface Subscriber {
  chatId: number
  username: string
  subscribedAt: string
  platforms: Platform[]
}

interface BuildInfo {
  name: string
  size: number
  file: string
}
```

## Troubleshooting

### Common Issues

1. **TypeScript Compilation Errors**
   ```bash
   npm run clean && npm run build
   ```

2. **Module Resolution Issues**
   - Ensure all imports use `.js` extensions (for ES modules)
   - Check that `"type": "module"` is set in package.json

3. **Test Failures**
   ```bash
   npm run build && npm run test
   ```

4. **Bot Not Responding**
   - Verify TELEGRAM_BOT_TOKEN is set
   - Check network connectivity
   - Review console logs for errors

### Debug Mode
```bash
NODE_ENV=development npm run start
```

## Contributing

1. Make changes in the `src/` directory
2. Run tests: `npm run test`
3. Build: `npm run build`
4. Test functionality with a development bot token

## License

MIT License - See main project LICENSE file.