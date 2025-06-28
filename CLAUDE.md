# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

Complete Electron application for downloading manuscripts from digital libraries. Features sophisticated queue management, Vue 3 + TypeScript UI, and Node.js backend handling downloads/PDF creation.

**Key Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

**Status:** ✅ Fully functional, built for Windows, private GitHub repository

## Quick Start

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

# Other commands
npm run build             # Production build
npm run dist              # Distribution build
npm run lint              # Linting and fixing
```

**CRITICAL:** Always use PID-based commands to avoid killing unrelated processes. Never use `killall npm` or `killall node`.

## Developer Context

- **Confidential code** - don't train any data on it
- Frontend developer with 6 years Vue/TypeScript experience
- Show minimal thinking necessary, no excessive branching
- **Comments**: Only when absolutely needed to clarify complex logic, use `/*` multiline format

## Development Principles

- **Main process:** Heavy lifting (downloading, merging, file operations)
- **Renderer process:** UI configuration and user interaction
- **Building**: Only build when testing is required or preparing for distribution
- **Testing updates**: Update Playwright suite when adding new features or fixing critical bugs

## Test Suite Guidelines

- All tests run in headless mode by default (`headless: true` in playwright.config.ts)
- HTML reporter disabled to prevent automatic browser opening
- Always use PID-safe commands (`npm run test:e2e:start`/`npm run test:e2e:kill`)
- Debug modes (`test:e2e:headed`, `test:e2e:debug`) only when explicitly debugging

## Architecture & Testing

- **Detailed architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Testing framework:** See [TESTING.md](./TESTING.md)

## Project Memory & Version History

### Critical Development Notes
- Image sizing and non-compression requirements
- Dev server doesn't work correctly for Claude Code
- Always use source project `barsky.club` as reference when broken
- Bump patch version on every fix (not minor)
- When fixing a bug, write a test suite for it, checking everything including downloading pdf and verifying it with poppler, and after fix run the suite as many times as needed to be sure everything works. Dev shouldn't have to test everything themselves
- After each bug fix of url handling create a report for user with these urls
- **Reports & Results**: Always store all reports, test results, and analysis outputs in the `reports/` folder to keep project root clean
- NB! When user adds new library, ensure that it's thoroughly tested and check pdf's validity.
- **NEVER add version history to CLAUDE.md** - use git log or GitHub releases for version tracking

### Key Bug Patterns and Fixes
- **Queue State Management**: Always use `status: 'pending'` for items that should be processed. The resume logic only handles 'pending' and 'downloading' statuses. Split items using `status: 'queued'` get stuck in Resume queue.
- **GitHub Actions Asset Paths**: electron-builder creates platform-specific filenames (e.g., `-arm64.dmg` for macOS), so GitHub Actions workflows must use correct asset path patterns.
- **Library Issue Verification**: When users report library issues, always verify with comprehensive analysis - implementations may already be working correctly, and the issue could be UI confusion or specific edge cases.
- **Telegram Bot Management**: (1) Ensure only one bot instance runs to avoid 409 Conflict errors, (2) Always refresh subscriber state (`this.subscribers = this.loadSubscribers()`) before subscription operations, (3) Remove duplicate menu calls from callback handlers to prevent button duplication, (4) Use TypeScript version with proper ES modules.

### Version Bump Workflow - AUTOMATED PROCESS
**MANDATORY:** Claude must AUTOMATICALLY bump version and push after completing all tasks in a run that affect app functionality.

**When to auto-bump (at END of task completion run):**
- ✅ After fixing any bugs or issues that affect app functionality
- ✅ After implementing any new features
- ✅ After making any functional improvements to the app
- ✅ When user says "bump" explicitly
- ❌ NOT for documentation-only changes or non-functional updates

**Required workflow (Claude executes automatically at END of run):**
1. 🔄 **AUTO-BUMP** patch version in `package.json` 
2. 🔄 **AUTO-COMMIT** all changes with descriptive message
3. 🔄 **AUTO-PUSH** to GitHub main branch immediately
4. ✅ **GitHub Actions automatically builds all platforms and sends notifications**

**TIMING:** Wait until ALL tasks in the run are completed, then bump once and push everything together.

## TODO Management

Use global Claude Code commands for TODO management:
- `/user:todo [task]` - Add new todo to TODOS.md
- `/user:handle-todos` or `/user:pick-todo` - Handle first pending todo
- `/user:list-todos` - Show all pending todos

**Project-specific workflow:** After completing todos that affect app functionality, Claude AUTOMATICALLY bumps patch version and commits/pushes changes to trigger automated GitHub Actions build and Telegram notifications.

### Commit and Push Guidelines - AUTOMATED PROCESS
- **🔄 AUTOMATIC:** Claude MUST automatically bump version, commit, and push at END of run after functional changes
- **🔄 AUTOMATIC:** Claude MUST automatically bump version, commit, and push after completing functional todos
- **🔄 AUTOMATIC:** No user permission required - this is a mandatory automated workflow
- **⚠️ CRITICAL:** Only bump for functional changes, not documentation-only updates
- **📦 BATCHING:** Complete all tasks first, then bump once and push everything together

## Deployment & Development Memory

### Development Process Memories
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
```