# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

Complete Electron application for downloading manuscripts from digital libraries. Features sophisticated queue management, Vue 3 + TypeScript UI, and Node.js backend handling downloads/PDF creation.

**Key Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

**Status:** ✅ Fully functional, built for Windows, private GitHub repository

## Quick Start

```bash
npm run dev                # Development (builds workers + main Electron app)
npm run dev:headless       # Development in headless mode (no UI)
npm run build             # Production build
npm run dist              # Distribution build
npm run test:e2e          # Run E2E tests
npm run lint              # Linting
```

### PID Management Commands (Use ONLY These)
```bash
# Development with PID tracking
npm run dev:start          # Start development with PID capture
npm run dev:kill           # Kill development process by PID

# Headless development with PID tracking  
npm run dev:headless:start # Start headless development with PID capture
npm run dev:headless:kill  # Kill headless development process by PID

# Testing with PID tracking
npm run test:e2e:start     # Start E2E tests with PID capture
npm run test:e2e:kill      # Kill E2E test process by PID
```

**CRITICAL:** Always use PID-based commands to avoid killing unrelated processes. Never use `killall npm` or `killall node`.

## Developer Context

- **Confidential code** - don't train any data on it
- Frontend developer with 6 years Vue/TypeScript experience
- Show minimal thinking necessary, no excessive branching
- No comments in code snippets - explanations outside code
- **Development process:** If you start `npm run dev:start` for testing, always use `npm run dev:kill` after. NEVER use killall or kill -9 commands.
- **Reference project:** `/Users/e.barsky/Desktop/Personal/site/barsky.club` - use as source when something breaks

## Development Principles

- Compare with source project (`barsky.club`) when issues arise - adapt to current project
- **Main process:** Heavy lifting (downloading, merging, file operations)
- **Renderer process:** UI configuration and user interaction
- Don't build after completing tasks (unless explicitly needed)
- On significant changes, update Playwright suite (ask permission or postpone)

## Test Suite Guidelines - CRITICAL BROWSER POLICY

**NEVER OPEN BROWSER WINDOWS DURING TESTING**
- All Playwright tests MUST run in headless mode (`headless: true`)
- User screen-shares on calls and browser windows compromise them
- This is a security/privacy violation that must never happen
- **CONFIGURED:** `playwright.config.ts` now enforces:
  - `headless: true` for all tests
  - `reporter: [['list'], ['json']]` instead of 'html' to prevent browser opening
- **VIOLATION PREVENTION:** Any test that opens a browser window is a critical bug
- Test functionality programmatically without visual browser windows
- HTML reporter disabled because it automatically opens browser with results

### MANDATORY TESTING COMMANDS FOR ALL CLAUDE INSTANCES:
- **PREFERRED:** `npm run test:e2e:start` and `npm run test:e2e:kill` for PID management
- **ACCEPTABLE:** `npm run test:e2e` (direct headless mode)
- **FORBIDDEN:** `npm run test:e2e:headed` or `npm run test:e2e:debug` (unless explicitly asked by user)
- **NEVER CREATE:** HTML debug files that open in browsers
- **NEVER RUN:** Any command that launches browser windows (unless explicitly asked by user)
- **SECURITY CRITICAL:** User screen-shares on calls - browser windows expose them
- **ALL CLAUDE INSTANCES:** Must follow this policy without exception
- **PROCESS SAFETY:** Always prefer PID-based commands to avoid killing unrelated processes
- **KILL POLICY:** NEVER use `killall`, `pkill`, or `kill -9` without specific PID

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

### Version Release Workflow - MANDATORY FOR EVERY VERSION BUMP
**CRITICAL: Follow this workflow whenever package.json version is bumped:**

1. **Build Windows AMD64 Release**:
   ```bash
   npm run dist:win
   ```

2. **Create Changelog Entry**:
   - Summarize changes in 1-2 sentences
   - Focus on user-facing improvements or bug fixes
   - Use format: "vX.X.X: [Brief description of main changes]"

3. **Send Telegram Notification**:
   ```bash
   TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo" node telegram-bot/send-multiplatform-build.js
   ```

4. **Verify Notification**:
   - Check that notification was sent to all subscribers
   - Ensure build file was attached (if <50MB) or download link provided

**Example Workflow Commands:**
```bash
# After version bump in package.json
npm run dist:win && TELEGRAM_BOT_TOKEN="7825780367:AAEgMIQxaG5hbDNJw9oLtylRxd7Ddr9vzBo" node telegram-bot/send-multiplatform-build.js
```

**Remember**: Every version increment should result in user notification via Telegram bot. This ensures subscribers get immediate access to fixes and new features.

### Version History
- **v1.0.29:** Added Unicatt (Biblioteca Ambrosiana) support with proxy fallback for geo-restricted access  
- **v1.0.31:** Added Cambridge CUDL, Trinity Cambridge, Dublin ISOS, Dublin MIRA, and Trinity Dublin libraries
- **v1.0.45:** Fixed Trinity Dublin full resolution image downloading - convert size-limited URLs (/full/600,/) to full resolution (/full/max/)
- **v1.0.49:** Fixed Trinity Cambridge downloads and auto-splitting - convert to /full/1000,/ for faster downloads, fixed critical auto-split bug where cached manifests had empty pageLinks
- **v1.0.54:** Added Orléans Médiathèques (Aurelia) library support with IIIF API integration for French regional manuscript collections
- **v1.0.55:** Fixed Orléans manifest loading timeout by limiting to first 20 media items and adding API call timeouts
- **v1.0.56:** Enhanced folder name sanitization to remove trailing periods for Windows compatibility (fixes Unicatt folder access issues)
- **v1.0.57:** Fixed Orleans AbortError by adding retry logic and improved timeout handling for API calls
- **v1.0.61:** Fixed ISOS 403 Forbidden errors by adding proper HTTP headers and using correct IIIF service URL format (/full/max/0/default.jpg), enhanced electron-store JSON sanitization to prevent corruption, and improved MIRA error handling for Trinity Dublin manifests
- **v1.0.62:** Fixed Orleans library hanging on 'calculating' stage by replacing concurrent batch processing with sequential processing, removing problematic Promise.race timeouts, and adding proper progress logging
- **v1.0.63:** Fixed Cambridge CUDL hanging on 'calculating' stage by adding proper HTTP headers to prevent 403 Forbidden errors and correcting manifest URL format
- **v1.0.64:** Enhanced MIRA error handling to distinguish between accessible institutions (ISOS/RIA) and blocked ones (Trinity Dublin with reCAPTCHA). Added detailed error messages identifying specific institutions and manifest URLs causing access issues.
- **v1.0.65:** Fixed manifest loading UI issues: page counter showing "1 of 0" now shows "Loading manifest...", Start Queue button text logic fixed to not show "Resume" during manifest loading, and improved loading state handling for better user experience.
- **v1.0.66:** Enhanced Orléans timeout handling: increased search and item fetch timeouts from 15s to 30s, added multiple fallback search strategies (original query, partial matches, case-insensitive variants), and added specific URL handling for "OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE" pattern to correctly map to "Ouvrages de Pseudo Isidore" API search.
- **v1.0.67:** Added manifest loading progress bar for slow-loading manifests (>50 pages). Shows real-time progress during Orleans manuscript loading with "Loading manifest: X/Y pages (Z%)" display. Progress updates every 10 processed pages to provide visual feedback during long manifest loading operations.
- **v1.0.68:** Enhanced cache management: "Cleanup Cache" button now clears both image and manifest caches, single item deletion clears that item's manifest cache, "Delete All" clears all manifest caches. Prevents stale cache entries and ensures fresh manifest loading when needed.
- **v1.0.70:** Implemented Orleans manifest loading progress bar with real-time percentage updates (e.g., "Loading manifest: 40/370 pages (11%)"), visual progress bar with teal gradient, minimum 2-second display time for visibility, and improved progress bar styling with subtle background and better visual integration.
- **v1.0.75:** Added Manuscripta.se support for Swedish digital manuscript catalogue. Supports IIIF 2.x and 3.x manifests with full resolution image downloading. Includes proxy fallback for connectivity issues and proper display name extraction from manifest metadata.
- **v1.0.71:** Added Stanford Parker Library support for digitized manuscripts from Corpus Christi College, Cambridge. Implemented IIIF v2/v3 compatible manifest parsing with full resolution image downloading. Successfully tested with 20+ manuscript URLs providing access to medieval manuscripts with comprehensive metadata extraction.
- **v1.0.72:** Fixed Stanford Parker Library HTTP 406 "Not Acceptable" errors by implementing proper headers (curl User-Agent instead of Chrome) and using direct IIIF image URLs from manifest (/full/full/ format). Downloads now work correctly for all Stanford Parker manuscripts.
- **v1.0.73:** Completed Stanford Parker Library implementation with comprehensive testing. All 22 user-provided URLs now working. Created end-user report documenting the new functionality and successful integration with existing manuscript libraries.
- **v1.0.74:** Fixed Orleans library hanging indefinitely on "calculating" stage after manifest loading by adding size estimation bypass (similar to Florus). Orleans manuscripts now proceed directly from manifest loading to downloading without attempting problematic first page download for size calculation.
- **v1.0.77:** Added Internet Culturale support for Italy's national digital heritage platform, providing access to manuscripts from BNCF Florence, Biblioteca Medicea Laurenziana, and ICCU collections. Fixed API integration by correcting XML parsing, adding required parameters (teca, mode=all, fulltext=0), and implementing proper OAI identifier handling. Successfully tested with 10 Florence manuscript URLs across multiple institutions.
- **v1.0.98:** Fixed Manuscripta.se hanging issue during download process by adding it to the list of libraries that skip first page download for size estimation (similar to Orleans fix in v1.0.74). The downloader was hanging on calculating stage when trying to download the first page to estimate total size, now uses estimated size calculation instead.
- **v1.1.4:** Fixed FLORUS (BM Lyon) hanging issue during download process by adding it to the list of libraries that skip first page download for size estimation (similar to Orleans fix in v1.0.74 and Manuscripta fix in v1.0.98). FLORUS manuscripts now proceed directly from manifest loading to downloading without attempting problematic first page download for size calculation.
- **v1.2.2:** Fixed Morgan Library (themorgan.org) manifest loading failures. Updated regex patterns to recognize new styled image format (/sites/default/files/styles/.../public/images/collection/) and convert to original high-resolution versions (/sites/default/files/images/collection/). Restored full functionality for Morgan Library manuscripts including Lindau Gospels.
- **v1.3.20:** Major release with 6 new library integrations and critical bug fixes: (1) Fixed University of Graz IIIF resolution extraction for full 5.3MB images vs 271KB thumbnails; (2) Added Cologne Dom Library with multi-collection support (HS/Schnütgen/DDBKHD); (3) Added Vienna Manuscripta.at Austrian National Library support; (4) Added Rome National Library (BNCR) support; (5) Added Berlin State Library with IIIF v2 compliance; (6) Added Czech Digital Library experimental support; (7) Added Modena Archive support bypassing Flash interface; (8) Fixed macOS DMG missing from Telegram notifications; (9) Fixed Playwright headed mode security issue; (10) Fixed NYPL manifest detection using carousel data; (11) Fixed Florence download speed with library optimization bug affecting 8 libraries.
- **v1.3.22:** Fixed Modena Archive hanging on last pages during download by adding it to libraries that skip first page download for size estimation (same pattern as Orleans v1.0.74, Manuscripta v1.0.98, FLORUS v1.1.4). Modena manuscripts now proceed directly from manifest loading to downloading without attempting problematic first page download.
- **v1.3.23:** Fixed image resolution issues for Morgan Library and Rome National Library (BNCR). Enhanced Morgan Library image extraction to capture direct full-size image references with new regex pattern for `/sites/default/files/images/collection/` URLs. Implemented dynamic resolution detection for BNCR manuscripts to automatically detect correct resolution parameters (`/full`, `/max`, `/high`, or `/large`) by parsing HTML content. Both libraries now download full-resolution images instead of thumbnails.
- **v1.3.24:** Fixed Modena Diocesan Archive hardcoded page count issue and hanging problems. Enhanced `loadModenaManifest` function to properly extract actual page counts from mobile interface JavaScript configuration instead of hardcoded 231 pages. Added comprehensive page count detection with multiple fallback strategies including binary search for image availability. Added Modena to skip size estimation list to prevent hanging at page 200 during download process (similar to Orleans, Manuscripta, FLORUS fixes).

## TODO Management System

Simple TODO tracking in `TODOS.md`:

### Adding TODOs
User says "todo: [task]" → Add to `TODOS.md` under "Pending Tasks"
IMPORTANT: When user adds a todo, ONLY add it to TODOS.md - do NOT start working on it immediately or create TodoWrite entries unless explicitly asked.

### Handling TODOs  
User says "handle todos" → Follow workflow:
1. Read first pending todo from `TODOS.md` - ONLY select todos WITHOUT ✅ checkmark
2. Fix/implement the task
3. Report completion to user
4. Update test suite if needed (`npm run test:e2e` or `npm run test:e2e:start`/`npm run test:e2e:kill` for PID management)
5. Update `CLAUDE.md` with insights/changes
6. **Move completed todo to `TODOS-COMPLETED.md`** instead of keeping in TODOS.md
7. Bump patch version in `package.json`
8. Commit changes and push to GitHub (triggers automated build & notification)

### TODO File Management
- **TODOS.md**: Keep clean with only pending tasks and usage instructions
- **TODOS-COMPLETED.md**: Archive all completed tasks organized by version
- When completing tasks, move them from TODOS.md to TODOS-COMPLETED.md to maintain clean separation

### Version Bump Workflow
When user says "bump" or when completing todos → Follow this workflow:
1. Bump patch version in `package.json`
2. Commit changes with descriptive message
3. Push to GitHub main branch
4. **MANDATORY: Check GitHub Actions build status** after pushing
5. GitHub Actions will automatically:
   - Detect version change
   - Build Windows AMD64 release
   - Create GitHub release
   - Send Telegram notifications to subscribers

**CRITICAL BUILD MONITORING:**
- Always check GitHub Actions status after pushing version bumps
- If builds fail, investigate immediately and fix before next version bump
- **CRITICAL**: Ensure package.json version changes are actually committed! GitHub Actions only triggers on committed version changes
- Common failures: Telegram bot dependency issues, missing TypeScript compilation, wrong script invocation, uncommitted version changes
- Use: `curl -s "https://api.github.com/repos/evb0110/mss-downloader/actions/runs?per_page=3" | jq -r '.workflow_runs[] | "\(.status) \(.conclusion) \(.name)"'`

**TELEGRAM BOT ISSUES RESOLVED:**
- Fixed duplicate messages: Bot was sending separate message per platform subscription instead of unified message
- Fixed missing download links: Improved file handling with GitHub releases fallback
- Fixed generic changelog: Added pattern matching for Orleans, GitHub Actions, and other meaningful fixes
- GitHub workflow updated to use `npm run send-multiplatform-build` instead of direct JS execution

CRITICAL: Only mark tasks as completed in TODOS.md when they are ACTUALLY FULLY IMPLEMENTED AND WORKING. Never mark something as completed based on code changes alone - verify the functionality works as expected.

### Commit and Push Guidelines
- **Whenever agent or user bump the version, it should be commited and pushed by the agent**

## Deployment & Development Memory

### Development Process Memories
- After push always wait to check that build was successful on github and everything was pushed to the bot

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