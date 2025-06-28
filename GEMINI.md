# Gemini Analysis: MSS Downloader

## Project Overview

This project is a desktop application named **Abba Ababus (MSS Downloader)**, built with Electron, Vue.js, and TypeScript. Its primary purpose is to download manuscripts from various digital libraries. The application features a sophisticated download queue management system, allowing users to add, monitor, and manage multiple download tasks.

A key component of the ecosystem is a **Telegram bot**, located in the `telegram-bot/` directory. This bot is responsible for notifying subscribers about new application builds.

## Core Technologies

- **Main Application:**
  - **Framework:** Electron
  - **UI:** Vue 3 with TypeScript
  - **Styling:** SCSS
  - **Build Tool:** Vite
  - **State Management:** `electron-store` for persisting the download queue.
  - **Key Dependencies:** `jspdf`, `pdf-lib` for PDF generation, `node-fetch` for downloading.

- **Telegram Bot:**
  - **Runtime:** Node.js with TypeScript
  - **Core Dependency:** `node-telegram-bot-api`

- **Testing:**
  - **End-to-End:** Playwright

## Architecture

The application follows a standard Electron architecture:

- **Main Process (`src/main`):** Handles all backend logic, including file system operations, network requests, and download queue management.
- **Renderer Process (`src/renderer`):** Manages the user interface, built with Vue.js.
- **Preload Script (`src/preload`)::** Securely exposes APIs from the main process to the renderer process.
- **Shared Code (`src/shared`):** Contains TypeScript types and interfaces used by both the main and renderer processes.
- **Web Workers (`src/workers`):** Offloads intensive tasks like PDF creation to a separate thread to avoid blocking the main thread.

**Key Files:**
- `src/main/main.ts`: Main process entry point and IPC handlers.
- `src/preload/preload.ts`: Secure IPC bridge.
- `src/shared/queueTypes.ts`: Shared TypeScript interfaces.
- `src/main/services/DownloadQueue.ts`: Core queue management logic.
- `src/main/services/UnifiedManuscriptDownloader.ts`: Unified downloader service.
- `src/renderer/components/DownloadQueueManager.vue`: The main UI component for the download queue.

## Detailed Analysis Reports

-   **Main Process Analysis:** See [.devkit/analysis/main-process-analysis.md](.devkit/analysis/main-process-analysis.md)
-   **Renderer Process Analysis:** See [.devkit/analysis/renderer-process-analysis.md](.devkit/analysis/renderer-process-analysis.md)
-   **Telegram Bot Analysis:** See [.devkit/analysis/telegram-bot-analysis.md](.devkit/analysis/telegram-bot-analysis.md)
-   **Build and Deployment Analysis:** See [.devkit/analysis/build-and-deploy-analysis.md](.devkit/analysis/build-and-deploy-analysis.md)

## Development & Build Scripts

- **`npm run dev`**: Starts the application in development mode with hot-reloading.
- **`npm run dev:start`**: Starts development with PID capture for safe process management.
- **`npm run dev:kill`**: Kills the development process using the captured PID.
- **`npm run build`**: Compiles the TypeScript code and builds the application for production.
- **`npm run dist`**: Creates distributable packages for different operating systems.
- **`npm run test:e2e`**: Executes end-to-end tests using Playwright.
- **`npm run test:e2e:start`**: Starts E2E tests with PID capture.
- **`npm run test:e2e:kill`**: Kills the E2E test process by PID.
- **`npm run telegram:start`**: Starts the Telegram bot.
- **`npm run telegram:send`**: Sends a build notification using the Telegram bot.

**Note:** When running development or test servers, prefer the PID-safe commands (`dev:start`/`dev:kill`, `test:e2e:start`/`test:e2e:kill`) to prevent orphaned processes.

## Operational Directives & Workflow

### Version Bump Workflow
When a version bump is required (e.g., after a fix or feature):
1.  **Bump Version:** Increment the patch version in `package.json`.
2.  **Commit:** Commit the change with a descriptive message.
3.  **Push:** Push the commit to the `main` branch.
4.  **Monitor:** GitHub Actions will automatically build, release, and notify subscribers via Telegram. Wait to confirm the build succeeds.

### Bug Fix & Verification Workflow
1.  **Write a Test:** Before fixing, create a new Playwright test that reproduces the bug. The test should check all relevant aspects, including downloading a PDF and verifying its integrity.
2.  **Fix the Bug:** Implement the code changes to fix the issue.
3.  **Verify:** Run the test suite repeatedly to ensure the fix is robust.
4.  **Report:** For fixes related to URL handling or new library implementations, create a report in the `reports/` directory detailing the changes, tests, and verification results.

### Critical Notes & Known Issues
- **Queue State:** When adding items to the download queue that should be processed immediately, set their status to `'pending'`. The resume logic only handles `'pending'` and `'downloading'`.
- **GitHub Actions Paths:** Remember that `electron-builder` creates platform-specific filenames (e.g., `app-arm64.dmg`). Ensure asset path patterns in GitHub Actions workflows are correct.
- **Telegram Bot:**
    - Run only one instance to avoid `409 Conflict` errors.
    - Always refresh the subscriber list from `subscribers.json` before performing subscription operations.
    - Ensure the TypeScript version is configured for proper ES module support.
- **Reporting:** Store all analysis, test results, and reports in the `/reports` directory to keep the project root clean.
- **New Libraries:** When adding a new library, test it thoroughly, including validation of any output (e.g., generated PDFs).
