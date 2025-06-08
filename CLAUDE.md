# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```

**Development Process Management:**
- If you start processes like `npm run dev` for testing purposes, always kill them and close their tab after that
- If there already is a running dev process, don't run another, just use existing one and don't kill it

## Architecture Overview

**Manuscript Downloader** is an Electron app extracted from the barsky.club Vue web application that provides a standalone desktop application for downloading manuscripts from 8 digital libraries. This project contains the complete, up-to-date manuscript downloading functionality without the need for a web browser.

### Supported Libraries (8 Total - 7 Working + 1 in Development)

**Working Libraries (7):**
1. **Gallica (BnF)** - French National Library digital manuscripts (supports any f{page}.* format)
2. **e-codices (Unifr)** - Swiss virtual manuscript library
3. **Vatican Library** - Vatican Apostolic Library digital collections
4. **Cecilia (Grand Albigeois)** - Grand Albigeois mediatheques digital collections
5. **IRHT (CNRS)** - Institut de recherche et d'histoire des textes digital manuscripts
6. **Dijon Patrimoine** - Bibliothèque municipale de Dijon digital manuscripts
7. **Durham University** - Durham University Library digital manuscripts via IIIF

**In Development (1):**
- **Laon Bibliothèque ⚠️** - Bibliothèque municipale de Laon digital manuscripts (NOT WORKING YET - proxy issues)

### Key Features Transferred from Vue Project

- **Complete Library Support**: All 8 libraries from the Vue project, including the latest Durham University IIIF integration
- **Modern UI/UX**: Exact styling and user experience as the Vue project, adapted for Electron
- **Cache Management**: Built-in cache statistics and clearing capabilities
- **Language Switching**: In-app language switching between English and Russian
- **Visual Library Warnings**: Clear indicators for libraries that aren't working yet
- **Error Handling**: Comprehensive error handling and user feedback
- **Progress Tracking**: Real-time download progress with ETA and speed indicators

### Key Differences from Web Version

- **No domain routing**: Single-purpose app focused only on manuscript downloading
- **No navigation system**: Clean UI without complex routing, header, or footer
- **Main process image downloading**: Electron handles CORS issues natively, no proxy needed for most libraries
- **Integrated cache management**: Manual cache cleanup via UI buttons to prevent disk bloat
- **In-app language switching**: Language selector in top controls instead of menu system

### Electron Architecture

**Structure**: 
- `/src/main/` - Electron main process (Node.js environment)
- `/src/renderer/` - Renderer process (Vue 3 + TypeScript UI)
- `/src/shared/` - Shared types and utilities between main/renderer
- `/workers-dist/` - Compiled Web Workers for PDF processing

**Process Communication**: 
- Main process handles image downloading, file system operations, cache management
- Renderer process handles UI and user interactions
- IPC (Inter-Process Communication) bridges main and renderer processes

### Multi-Language System

**Translation Structure**: Complete i18n support
- `en.ts`, `ru.ts` - Complete translation files with all 8 libraries documented
- Language switching through in-app controls in top navigation
- Persistent language preference stored in electron-store

### PDF Processing Architecture

**Core Services**:
- `UnifiedManuscriptDownloader` - Main service supporting all 8 libraries (adapted for Electron)
- `ElectronPdfMerger` - PDF creation service using Node.js in main process
- `ElectronImageCache` - File system-based image cache with automatic cleanup
- `pdf-worker.ts` - Web Worker for CPU-intensive PDF processing in renderer

**Key Differences from Web Version**:
- **No proxy services needed**: Electron can download images directly from most sources
- **File system cache**: Images cached to user data directory with metadata tracking
- **Native save dialogs**: Uses Electron's dialog API for PDF save location
- **Better memory management**: Leverages Node.js capabilities for large file handling

**PDF Creation Process**:
1. Images downloaded in main process (avoiding CORS)
2. **Cache management** - Users can view cache stats and clear cache manually
3. PDF creation handled by worker with **unlimited resolution** for maximum quality
4. Save dialog for output location
5. **Optimal performance** - consistent fast downloads with cache management

### Key Architectural Patterns

1. **IPC Communication**: Main and renderer processes communicate via Electron IPC
2. **Service Layer**: Clear separation between UI (renderer) and business logic (main process)  
3. **Worker Pattern**: CPU-intensive PDF tasks handled in Web Workers
4. **Cache-first**: Images cached to filesystem for performance with manual cleanup
5. **Native Integration**: Uses Electron APIs for file dialogs, menus, notifications

## Project Status & Implementation Details

**Current Implementation Status:**
- ✅ Main process services (UnifiedManuscriptDownloader, ElectronPdfMerger)
- ✅ Renderer UI with Vue 3 + TypeScript (completely updated ManuscriptDownloader component)
- ✅ IPC communication setup between main/renderer processes
- ✅ Multi-language support with in-app switching (EN/RU)
- ✅ All 8 libraries supported (7 working + 1 in development)
- ✅ Image downloading without CORS issues (main process handles all network requests)
- ✅ **Complete UI redesign**: Modern, clean interface matching Vue project exactly
- ✅ **Cache management**: Statistics viewing and manual cache clearing
- ✅ **Visual indicators**: Warning symbols for non-working libraries
- ✅ **Example integration**: Click-to-use examples for each library
- ✅ PDF creation with Web Workers for unlimited resolution and maximum quality
- ❌ Main process services need to be updated to support all 8 libraries
- ❌ Full testing with all manuscript sources

**Key Files to Understand:**
- `src/main/main.ts` - Electron main process entry point (needs updating)
- `src/main/services/UnifiedManuscriptDownloader.ts` - Core downloading logic (needs updating)
- `src/main/services/ElectronImageCache.ts` - File system caching (needs updating)
- `src/main/services/ElectronPdfMerger.ts` - PDF creation (needs completion)
- `src/renderer/components/ManuscriptDownloader.vue` - ✅ Completely updated main UI component
- `src/shared/types.ts` - ✅ Updated shared TypeScript interfaces
- `src/preload/preload.ts` - IPC bridge between main/renderer (needs updating)
- `src/renderer/translations/` - ✅ Complete translation files for all 8 libraries

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
- Main process downloads images directly (no CORS issues)
- Images cached to user data directory with metadata
- PDF creation shows save dialog for output location
- Cache manually managed by users via UI controls
- Language preference persists via electron-store
- UI matches Vue project styling exactly

## Manuscript Source Support

**Gallica (BnF):** ✅ Implemented
- Handles various URL formats (.item, .image, .zoom, .planchecontact, .thumbs)
- Automatically converts to planchecontact format for image extraction
- Extracts ARK IDs for naming
- Direct downloading without proxies

**e-codices (Unifr):** ✅ Implemented  
- Supports multiple URL patterns
- Extracts collection and manuscript codes
- Image URL transformation for high-res versions

**Vatican Library:** ✅ Implemented
- Handles digi.vatlib.it URLs
- Extracts manuscript identifiers
- Image quality optimization

**Cecilia (Grand Albigeois):** ✅ Implemented
- Supports viewer URLs with offset parameters
- Handles mediatheques digital collections
- Image extraction from viewer interface

**IRHT (CNRS):** ✅ Implemented
- Processes ark URLs from IRHT collections
- Handles Institut de recherche et d'histoire des textes manuscripts
- ARK ID extraction and processing

**Dijon Patrimoine:** ✅ Implemented
- Supports img-viewer URLs
- Handles municipal library digital manuscripts
- Image manifest processing

**Durham University:** ✅ Implemented
- IIIF Presentation API 2.x and 3.x support
- Handles Durham's trifle directory structure
- High-quality image downloads via IIIF

**Laon Bibliothèque:** ⚠️ Not Working Yet
- `loadLaonManifest()` implemented but has proxy issues
- Clearly marked in UI with warning symbols
- Need to resolve proxy configuration issues

## Working with PDF Processing

**Current PDF Implementation:**
- `ElectronPdfMerger` needs integration with real PDF library
- Consider using `pdf-lib` or `PDFKit` for actual PDF creation
- Worker pattern ready for CPU-intensive operations
- Save dialog integration already implemented

**Performance Optimizations:** 
- **Cache management** - Users can view cache statistics and clear cache manually
- **Unlimited resolution** - Canvas dimension limits removed for maximum image quality
- **Direct downloads** - Clean, fast downloads using browser/OS native caching for most libraries
- **Maximum JPEG quality** - Quality set to 1.0 for all platforms to preserve manuscript detail
- **Simplified architecture** - Clean separation between UI and business logic

## User Interface Features

**Language Switching:**
- Top-right controls with EN/RU buttons
- Persistent language preference
- Complete translations for all libraries

**Cache Management:**
- Cache statistics button showing size and entry count
- Clear cache button with confirmation
- Visual feedback for cache operations

**Library Support:**
- Visual warning indicators (⚠️) for non-working libraries
- Click-to-use examples for each library
- Comprehensive library descriptions
- Hover effects and modern styling

**Download Interface:**
- Real-time progress tracking
- ETA and speed indicators
- Status messages with color coding
- Error handling with clear messaging

## Troubleshooting

**Common Issues:**
- If TypeScript build fails, ensure dependencies are fully installed
- Check that preload script is properly compiled
- Verify IPC communication is working via dev tools
- Cache issues can be resolved via "Clear Cache" button in UI

**Development Tools:**
- Electron dev tools available in development mode
- Vue dev tools work in renderer process
- Console logging available in both main and renderer processes

## Next Steps for Completion

1. **Update Main Process Services:** Transfer all 8 library implementations from Vue project to Electron main process
2. **Complete PDF Creation:** Replace ElectronPdfMerger placeholder with actual PDF library
3. **Update IPC Handlers:** Add support for cache management and all library types
4. **Error Handling:** Ensure robust error handling matches Vue project
5. **Testing:** Test with real manuscripts from all supported libraries
6. **Polish:** Fine-tune any remaining UI/UX differences

## Transfer Status from Vue Project

**✅ Completed:**
- UI/UX completely redesigned and matches Vue project
- All 8 libraries documented and supported in types
- Complete translation system with all libraries
- Language switching functionality
- Cache management UI
- Visual library warnings and examples
- Modern styling and responsive design

**🔄 In Progress:**
- Main process service updates
- IPC handler updates for new functionality
- PDF creation service completion

**⏳ Remaining:**
- Full testing with all libraries
- Production build optimization
- Distribution package testing

## Commit Message Format

When creating commits:
- Start with component/area being changed
- Use present tense, concise descriptions
- Example: "renderer: update ManuscriptDownloader component with all 8 libraries"
- Example: "translations: add support for all manuscript libraries"
- Example: "main: implement Durham University IIIF support"