# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary (mss-downloader)

This is a complete and functional Electron application for downloading manuscripts from various digital libraries. It features a sophisticated queue management system, allowing users to batch-process downloads, manage individual items, and track progress in real-time. The UI is built with Vue 3 and TypeScript, and the backend logic runs in the Electron main process, handling all downloads, file system operations, and PDF creation.

**Key Technologies:**
- **Frameworks:** Electron, Vue 3
- **Languages:** TypeScript
- **Styling:** SCSS
- **Build Tools:** Vite, Electron Builder
- **Core Dependencies:** `electron-store` for data persistence.

The project is fully functional, has been successfully built for Windows, and the codebase is stored in a private GitHub repository.

## Developer Context
- All code is confidential, don't train any data on it!!!
- Frontend developer with 6 years of Vue experience, working with TypeScript
- Show only reasonable amount of thinking necessary to understand conclusions, not all branches and attempts
- Don't add comments into created code snippets, all explanations should be outside of the code itself

## Development Commands

```bash
# Development (builds workers + main Electron app)
npm run dev

# Build workers only (for development)  
npm run dev:renderer

# Production build (workers + main app)
npm run build

# Distribution builds
npm run dist        # Current platform
npm run dist:win    # Windows
npm run dist:mac    # macOS

# Linting
npm run lint
npm run lint:fix

# End-to-End Testing
npm run test:e2e          # Run E2E tests (headless)
npm run test:e2e:headed   # Run E2E tests (with UI)
npm run test:e2e:debug    # Run E2E tests in debug mode
```

**Development Process Management:**
- If you start processes like `npm run dev` for testing purposes, always kill them and close their tab after that
- If there already is a running dev process, don't run another, just use existing one and don't kill it

## Architecture Overview

**Manuscript Downloader** is an Electron app with a powerful queue management system that provides a standalone desktop application for downloading manuscripts from various digital libraries.

### Supported Libraries
- Gallica (BnF)
- e-codices (Unifr)
- Vatican Library (digi.vatlib.it)
- Unicatt (Biblioteca Ambrosiana) - with proxy fallback for geo-restricted access
- And others supported by the underlying downloader services.

### Key Features

- **Advanced Download Queue:**
  - Add multiple manuscript URLs for bulk processing.
  - Real-time queue progress bar and statistics.
  - Manage individual items: pause, resume, delete, and edit download options (page range, concurrency).
  - Start, pause, resume, and stop the entire queue.
- **Data Persistence:** The download queue state is saved to disk using `electron-store`, so the queue is restored between app sessions.
- **Modern UI/UX:** A professional and responsive user interface built with Vue 3, adapted from `barsky.club`.
- **IPC Architecture:** Robust communication between the renderer (Vue UI) and main (Node.js) processes.
- **Cache Management:** Functionality to clean up the image cache for downloaded manuscripts.

### Key Differences from a Web Version

- **No CORS issues:** The Electron main process handles all network requests, bypassing browser-based cross-origin restrictions.
- **Direct File System Access:** The application can read/write directly to the user's file system for caching and saving PDFs.
- **Persistent State:** `electron-store` is used to maintain the queue state across application restarts.
- **Native Integration:** Utilizes Electron's native capabilities for a seamless desktop experience.

### Electron Architecture

**Structure**:
- `/src/main/` - Electron main process (Node.js environment).
  - `services/DownloadQueue.ts`: Manages the state and processing of the download queue.
  - `services/UnifiedManuscriptDownloader.ts`: Handles the logic for downloading a single manuscript.
- `/src/renderer/` - Renderer process (Vue 3 + TypeScript UI).
  - `components/DownloadQueueManager.vue`: The main UI component for managing the download queue.
- `/src/preload/` - Preload script that securely exposes main process APIs to the renderer process.
- `/src/shared/` - Shared types and utilities between main/renderer.
- `/workers-dist/` - Compiled Web Workers for PDF processing.

**Process Communication**:
- The main process handles all core logic: downloading, queue management, file system operations, and PDF creation.
- The renderer process is responsible for the user interface and user interactions.
- A comprehensive IPC (Inter-Process Communication) bridge is defined in `preload.ts` to connect the two processes securely.

## Project Status & Implementation Details

**Current Implementation Status:** ✅ **Complete**
- ✅ **Queue Management:** Fully functional `DownloadQueue` service in the main process with persistence.
- ✅ **Renderer UI:** A complete `DownloadQueueManager.vue` component that mirrors the functionality and style of the `barsky.club` reference.
- ✅ **IPC Communication:** A robust set of IPC channels are set up for all necessary communication between the main and renderer processes.
- ✅ **Build System:** The project successfully builds for development (`npm run dev`) and production (`npm run build`, `npm run dist:win`).
- ✅ **Styling:** All UI components are styled with a modern and professional design.
- ✅ **GitHub:** The project is version-controlled with Git and has been pushed to a private GitHub repository.

**Key Files to Understand:**
- `src/main/main.ts` - Electron main process entry point, which handles all IPC calls from the renderer.
- `src/main/services/DownloadQueue.ts` - The core state machine for the download queue.
- `src/renderer/components/DownloadQueueManager.vue` - The primary Vue component that provides the user interface for the queue.
- `src/shared/queueTypes.ts` - Shared TypeScript interfaces for the queue items and state.
- `src/preload/preload.ts` - The IPC bridge that defines the API available to the renderer process.

## Development Workflow

**Starting Development:**
```bash
npm install                # Install all dependencies
npm run dev               # Start development mode (builds workers + starts Electron)
```

**Building for Production:**
```bash
npm run build            # Build all components
npm run dist             # Create distribution packages
npm run dist:mac         # macOS-specific build
npm run dist:win         # Windows-specific build
```

**Key Development Notes:**
- The main process handles all network requests and file system operations.
- The download queue state is persisted in the user's app data directory via `electron-store`.
- The UI is designed to be responsive and provide a great user experience.
- All core functionality is complete and the application is ready for use.

## Reference Project
- Source project for this application: `/Users/e.barsky/Desktop/Personal/site/barsky.club`
- Node and Vue based project

## Development Principles
- In case something isn't working as expected you should start with comparing with the source project, adapting it to current project.
- Downloading / merging should be done in node / main, configuration should be from ui.
- So in electron app you merge node for heavylifting and vue for ui

## Debugging Findings

- All findings from the referenced thread will be added here to help track and resolve any potential issues or insights discovered during development.

## Memory Notes
- Always use source project barsky.club as reference if something is broken
- on every fix bump minor version
- not minor, but patch

## Library Testing Protocol

When implementing new manuscript libraries, use this testing methodology:

```bash
# 1. Test IIIF manifest accessibility
curl -s "https://library-domain.com/iiif/manuscript-id/manifest.json" | head -20

# 2. Verify manifest structure and extract image URLs
curl -s "https://manifest-url" | jq '.sequences[0].canvases[0].images[0].resource | keys'
curl -s "https://manifest-url" | jq -r '.sequences[0].canvases[0].images[0].resource."@id"'

# 3. For embedded manifests (like MIRA), check page HTML
curl -s "https://page-url" | grep -i "iiif\|manifest\|json" | head -5

# 4. Test different URL patterns to understand manuscript ID extraction
curl -s "https://library-domain.com/manuscript/ID/manifest" | jq '.sequences[0].canvases | length'

# 5. Always build and lint after implementation
npm run build:main
npm run lint
```

**Important Testing Notes:**
- Don't start dev server for testing - you cannot control it properly through Claude Code
- Use curl commands to verify IIIF manifests are accessible and parseable
- Test actual image URL extraction from manifest JSON structure
- Verify manuscript ID extraction regex patterns work with real URLs

## Memories
- image sizing and non-compression
- devserver doesn't work correctly for you. If you need, I can start it
- v1.0.29: Added Unicatt (Biblioteca Ambrosiana) support with proxy fallback mechanism for geo-restricted access
- v1.0.31: Added Cambridge CUDL, Trinity Cambridge, Dublin ISOS, Dublin MIRA, and Trinity Dublin libraries
- v1.0.45: Fixed Trinity Dublin full resolution image downloading - convert size-limited URLs (/full/600,/) to full resolution (/full/max/)
- v1.0.49: Fixed Trinity Cambridge downloads and auto-splitting - convert to /full/1000,/ for faster downloads, fixed critical auto-split bug where cached manifests had empty pageLinks
- don't build after completing a task
- on every significant change keep playwright suite up to date, ask user's permission to run the suite or postpone

## Testing Framework

This testing framework is designed for comprehensive validation of complex applications, with three distinct levels of guidance that can be applied across different project types.

### 1. Universal Testing Principles

These principles apply to any testing scenario - web applications, Node.js services, mobile apps, or desktop applications.

#### Core Testing Philosophy
- **Verify, Don't Assume**: Always confirm that UI interactions and operations succeeded before proceeding
- **Systematic Validation**: Test one component/feature at a time with complete isolation between tests
- **Evidence-Based Testing**: Use screenshots, logs, and external validation tools to confirm results
- **Robust Error Handling**: Test both expected success paths and failure scenarios comprehensively

#### Screenshot Strategy
- **Timestamped Screenshots**: Use ISO timestamps in filenames for precise debugging chronology
- **State Analysis**: Capture screenshots before/after critical operations to analyze state changes
- **Failure Documentation**: Always screenshot failure states with full context visible
- **Progress Monitoring**: Take periodic screenshots during long-running operations

#### Test Autonomy Principles
- **Self-Healing Tests**: When operations fail, investigate and adapt rather than blindly retrying
- **Source Code Investigation**: When UI interactions fail, examine the actual implementation to understand why
- **Dynamic Problem Solving**: Use available debugging tools and evidence to modify test approach in real-time
- **Comprehensive Validation**: Don't just test happy paths - validate edge cases and error conditions

#### Selector Strategy (Universal)
- **Stable Selectors**: Use data attributes, IDs, and CSS classes rather than text-based selectors
- **Hierarchy Awareness**: Understand component structure to select elements reliably
- **Fallback Strategies**: Have multiple selector approaches for critical elements
- **Cross-Platform Consistency**: Use selectors that work across different environments

### 2. Electron-Specific Testing

These practices are specific to Electron applications with their unique multi-process architecture.

#### Electron Test Environment Setup
```bash
# Headless mode for CI/automated testing
npm run test:e2e

# Headed mode for debugging (only when needed)
npm run test:e2e:headed

# Debug mode with full DevTools access
npm run test:e2e:debug
```

#### Electron Architecture Considerations
- **Process Communication**: Test IPC communication between main/renderer processes
- **Build Environment**: Always test against built versions, not dev server for production validation
- **Platform-Specific Issues**: Test builds on target platforms (macOS entitlements, Windows signing, etc.)
- **Native Integration**: Validate file system access, native dialogs, and OS-specific features

#### Electron Headless Configuration
```typescript
// Configure Electron for headless testing
const electronApp = await electron.launch({
  args: [path.join(__dirname, '../../../dist/main/main.js'), '--headless'],
  env: { NODE_ENV: 'test' }
});

// Main process headless setup
const isHeadless = process.argv.includes('--headless') || process.env.NODE_ENV === 'test';
const mainWindow = new BrowserWindow({
  show: !isHeadless,
  ...(isHeadless && {
    x: -2000, y: -2000,
    skipTaskbar: true
  })
});
```

#### Electron-Specific Testing Patterns
- **Build Validation**: Test distribution builds, not just development versions
- **State Persistence**: Validate `electron-store` and other persistence mechanisms
- **Security Configuration**: Test preload scripts, context isolation, and security policies
- **Update Mechanisms**: Validate auto-updater functionality if implemented

### 3. Project-Specific Testing (MSS Downloader)

These are the specific testing requirements for the manuscript downloader functionality.

#### Manuscript Library Testing Protocol
```bash
# 1. Validate library URL patterns and manifest accessibility
curl -s "https://library-domain.com/iiif/manuscript-id/manifest.json" | head -20

# 2. Test manifest structure and image URL extraction
curl -s "https://manifest-url" | jq '.sequences[0].canvases[0].images[0].resource."@id"'

# 3. Verify manuscript count and structure
curl -s "https://manifest-url" | jq '.sequences[0].canvases | length'
```

#### Download Validation Strategy
- **Auto-split Testing**: Configure 30MB thresholds and verify manuscripts split correctly
- **Progress Tracking**: Confirm real numerical progress (not stuck at 0%)
- **Queue Management**: Test start/pause/resume/stop with multiple manuscripts
- **PDF Validation**: Use poppler utilities (`pdfinfo`) to verify downloaded PDFs

#### Library-Specific Testing Requirements
```typescript
// Test each supported library systematically
const testLibraries = [
  { name: 'Gallica (BnF)', url: 'https://gallica.bnf.fr/ark:/12148/...' },
  { name: 'e-codices (Unifr)', url: 'https://www.e-codices.ch/en/...' },
  { name: 'Vatican Library', url: 'https://digi.vatlib.it/view/...' },
  // ... etc
];

// Validation criteria for each library
for (const library of testLibraries) {
  // 1. Manifest loading success
  // 2. Proper display name extraction
  // 3. Page count accuracy
  // 4. Download initiation capability
}
```

#### Critical Test Coverage Areas
- **Download Engine**: Real progress tracking with ETA calculations
- **Auto-split Functionality**: Large manuscripts properly divided at configured thresholds
- **Queue Persistence**: State maintained across application restarts
- **Error Recovery**: Proper handling of network failures, captcha requirements, server errors
- **File System Operations**: PDF creation, cache management, download folder access
- **UI State Management**: Settings persistence, progress updates, error display

#### Performance Testing
- **Concurrent Downloads**: Validate multiple simultaneous downloads with configured concurrency
- **Large Manuscript Handling**: Test auto-split behavior with 1000+ page manuscripts
- **Memory Management**: Monitor memory usage during extended download sessions
- **Cache Efficiency**: Validate image caching and cleanup functionality

#### Regression Testing
```bash
# Comprehensive test suite for all supported libraries
npm run test:e2e

# Specific library validation
npx playwright test tests/e2e/library-manifest-test.spec.ts

# Download functionality validation
npx playwright test tests/e2e/download-validation-test.spec.ts
```

This three-tier testing framework ensures comprehensive coverage while maintaining reusability across different project types and technical stacks.