# Architecture Overview

**Manuscript Downloader** is an Electron app with a powerful queue management system that provides a standalone desktop application for downloading manuscripts from various digital libraries.

## Supported Libraries
- Gallica (BnF)
- e-codices (Unifr)
- Vatican Library (digi.vatlib.it)
- Unicatt (Biblioteca Ambrosiana) - with proxy fallback for geo-restricted access
- Cambridge CUDL, Trinity Cambridge, Dublin ISOS, Dublin MIRA, and Trinity Dublin libraries

## Key Features

- **Advanced Download Queue:**
  - Add multiple manuscript URLs for bulk processing
  - Real-time queue progress bar and statistics
  - Manage individual items: pause, resume, delete, and edit download options (page range, concurrency)
  - Start, pause, resume, and stop the entire queue
- **Data Persistence:** The download queue state is saved to disk using `electron-store`, so the queue is restored between app sessions
- **Modern UI/UX:** A professional and responsive user interface built with Vue 3, adapted from `barsky.club`
- **IPC Architecture:** Robust communication between the renderer (Vue UI) and main (Node.js) processes
- **Cache Management:** Functionality to clean up the image cache for downloaded manuscripts

## Key Differences from Web Version

- **No CORS issues:** The Electron main process handles all network requests, bypassing browser-based cross-origin restrictions
- **Direct File System Access:** The application can read/write directly to the user's file system for caching and saving PDFs
- **Persistent State:** `electron-store` is used to maintain the queue state across application restarts
- **Native Integration:** Utilizes Electron's native capabilities for a seamless desktop experience

## Electron Architecture

### Structure
- `/src/main/` - Electron main process (Node.js environment)
  - `services/DownloadQueue.ts`: Manages the state and processing of the download queue
  - `services/UnifiedManuscriptDownloader.ts`: Handles the logic for downloading a single manuscript
- `/src/renderer/` - Renderer process (Vue 3 + TypeScript UI)
  - `components/DownloadQueueManager.vue`: The main UI component for managing the download queue
- `/src/preload/` - Preload script that securely exposes main process APIs to the renderer process
- `/src/shared/` - Shared types and utilities between main/renderer
- `/workers-dist/` - Compiled Web Workers for PDF processing

### Process Communication
- The main process handles all core logic: downloading, queue management, file system operations, and PDF creation
- The renderer process is responsible for the user interface and user interactions
- A comprehensive IPC (Inter-Process Communication) bridge is defined in `preload.ts` to connect the two processes securely

## Key Files

- `src/main/main.ts` - Electron main process entry point, which handles all IPC calls from the renderer
- `src/main/services/DownloadQueue.ts` - The core state machine for the download queue
- `src/renderer/components/DownloadQueueManager.vue` - The primary Vue component that provides the user interface for the queue
- `src/shared/queueTypes.ts` - Shared TypeScript interfaces for the queue items and state
- `src/preload/preload.ts` - The IPC bridge that defines the API available to the renderer process

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