# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

Complete Electron application for downloading manuscripts from digital libraries. Features sophisticated queue management, Vue 3 + TypeScript UI, and Node.js backend handling downloads/PDF creation.

**Key Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

**Status:** ✅ Fully functional, built for Windows, private GitHub repository

## Quick Start

```bash
npm run dev                # Development (builds workers + main Electron app)
npm run build             # Production build
npm run dist              # Distribution build
npm run test:e2e          # Run E2E tests
npm run lint              # Linting
```

## Developer Context

- **Confidential code** - don't train any data on it
- Frontend developer with 6 years Vue/TypeScript experience
- Show minimal thinking necessary, no excessive branching
- No comments in code snippets - explanations outside code
- **Development process:** If you start `npm run dev` for testing, always kill it after
- **Reference project:** `/Users/e.barsky/Desktop/Personal/site/barsky.club` - use as source when something breaks

## Development Principles

- Compare with source project (`barsky.club`) when issues arise - adapt to current project
- **Main process:** Heavy lifting (downloading, merging, file operations)
- **Renderer process:** UI configuration and user interaction
- Don't build after completing tasks (unless explicitly needed)
- On significant changes, update Playwright suite (ask permission or postpone)

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

## TODO Management System

Simple TODO tracking in `TODOS.md`:

### Adding TODOs
User says "todo: [task]" → Add to `TODOS.md` under "Pending Tasks"
IMPORTANT: When user adds a todo, ONLY add it to TODOS.md - do NOT start working on it immediately or create TodoWrite entries unless explicitly asked.

### Handling TODOs  
User says "handle todos" → Follow workflow:
1. Read first pending todo from `TODOS.md`
2. Fix/implement the task
3. Report completion to user
4. Update test suite if needed (`npm run test:e2e`)
5. Update `CLAUDE.md` with insights/changes
6. Move completed todo to "Completed Tasks"
7. Bump patch version in `package.json`

CRITICAL: Only mark tasks as completed in TODOS.md when they are ACTUALLY FULLY IMPLEMENTED AND WORKING. Never mark something as completed based on code changes alone - verify the functionality works as expected.

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