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

## Testing Section

### Critical Testing Principles
- **Always verify actions succeeded** - Don't assume UI interactions worked, check the result immediately
- **Analyze screenshots thoroughly** - Look for collapsed sections, disabled buttons, validation errors before proceeding
- **Check source code defaults** - When tests fail to change settings, investigate the actual default values in code
- **Expand collapsed UI sections** - Settings might be hidden in closed spoilers/accordions - click to expand them first
- **Test one library at a time** - Add one, test thoroughly, delete, add next to isolate issues
- **Use proper selectors** - Never rely on text-based selectors, only CSS classes and data attributes
- **Validate with tools** - Use `pdfinfo` to verify actual PDF page count and file validity
- **Set reasonable test limits** - Use 30MB for testing, not 800MB+ that will never complete within test timeouts

### Common Testing Mistakes & Solutions
- **Range input sliders**: `slider.fill()` doesn't work - use `evaluate()` with direct value assignment + events
- **Hidden settings**: Always check if settings sections are collapsed and expand them before configuring
- **Infinite waiting**: Don't wait indefinitely - verify actions worked and modify approach if they didn't
- **Text-based selectors**: Use `.start-btn` instead of `button:has-text("Start")` for reliability
- **Assumption failures**: When something doesn't work as expected, investigate and fix rather than continuing

### Testing Strategies
- **End-to-End PDF Validation**: Test each library individually with poppler PDF verification
- **Auto-split threshold testing**: Verify 30MB limits are actually applied by checking downloads split appropriately
- **Manifest loading verification**: Wait for actual completion, not just timeouts
- **UI state analysis**: Capture and analyze page state through screenshots and element inspection
- **Error handling**: Test both expected and unexpected failure scenarios

### Required Test Coverage
- **Download Queue Management**: Start/stop/pause functionality with proper state transitions
- **Manuscript Library Support**: Each supported library with manifest loading and download validation
- **Auto-split functionality**: Large manuscripts split at configured thresholds (30MB for testing)
- **PDF Generation**: Valid PDFs with correct page counts using poppler verification
- **Error Recovery**: Proper handling of network failures, captcha requirements, blocked access