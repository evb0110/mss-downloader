# Development Guide

## Commands Reference

### Development Commands (PID-safe)
```bash
# Development with PID tracking (PREFERRED)
npm run dev:start          # Start development with PID capture
npm run dev:kill           # Kill development process by PID
npm run dev:headless:start # Start headless development with PID capture
npm run dev:headless:kill  # Kill headless development process by PID

# Testing with PID tracking (PREFERRED)
npm run test:e2e:start     # Start E2E tests with PID capture
npm run test:e2e:kill      # Kill E2E test process by PID

# Process monitoring and cleanup
npm run ps                # Monitor running processes
npm run cleanup           # Clean up all project processes
npm run cleanup:all       # Comprehensive cleanup

# Other commands
npm run build             # Production build
npm run dist              # Distribution build
npm run lint              # Linting and fixing
```

**CRITICAL:** Always use PID-based commands to avoid killing unrelated processes. Never use `killall npm` or `killall node`.

### Process Management
- **Enhanced PID tracking**: All processes tracked with robust cleanup
- **Automatic cleanup**: Scripts register cleanup functions on exit
- **Comprehensive monitoring**: `npm run ps` shows all running processes
- **Emergency cleanup**: `npm run cleanup:all` for stuck processes
- **Documentation**: See `.devkit/docs/process-management.md` for details

## Test Suite Guidelines

- All tests run in headless mode by default (`headless: true` in playwright.config.ts)
- HTML reporter disabled to prevent automatic browser opening
- Always use PID-safe commands (`npm run test:e2e:start`/`npm run test:e2e:kill`)
- Debug modes (`test:e2e:headed`, `test:e2e:debug`) only when explicitly debugging

## Key Bug Patterns and Fixes

- **Queue State Management**: Always use `status: 'pending'` for items that should be processed. The resume logic only handles 'pending' and 'downloading' statuses. Split items using `status: 'queued'` get stuck in Resume queue.
- **GitHub Actions Asset Paths**: electron-builder creates platform-specific filenames (e.g., `-arm64.dmg` for macOS), so GitHub Actions workflows must use correct asset path patterns.
- **Library Issue Verification**: When users report library issues, always verify with comprehensive analysis - implementations may already be working correctly, and the issue could be UI confusion or specific edge cases.
- **Telegram Bot Management**: (1) Ensure only one bot instance runs to avoid 409 Conflict errors, (2) Always refresh subscriber state (`this.subscribers = this.loadSubscribers()`) before subscription operations, (3) Remove duplicate menu calls from callback handlers to prevent button duplication, (4) Use TypeScript version with proper ES modules.
- **Telegram Bot Changelog Generation**: Fixed in telegram-bot/src/send-multiplatform-build.ts to parse VERSION commits and extract meaningful user-facing changes instead of showing generic "Latest updates" or version numbers. Now shows specific fixes like "Fixed Vienna Manuscripta page downloads" instead of "VERSION-1.3.52". When fixing Telegram bot issues, commit only bot files without version bumping main app.

## Development Process Memories
- After push always wait to check that build was successful on github and everything was pushed to the bot
- When I inform you that something isn't working, it can mean only that your previous fixes didn't fix anything, not that I gave same task twice

## File Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── services/DownloadQueue.ts
│   └── services/UnifiedManuscriptDownloader.ts
├── renderer/                # Vue 3 + TypeScript UI
│   └── components/DownloadQueueManager.vue
├── preload/                 # IPC bridge
└── shared/                  # Shared types/utilities
```

**Key Files:**
- `src/main/main.ts` - Main process entry + IPC handlers
- `src/preload/preload.ts` - Secure IPC bridge
- `src/shared/queueTypes.ts` - Shared TypeScript interfaces