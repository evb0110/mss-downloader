# PDF-lib Module Not Found Error on Windows - Analysis and Fix

## Problem Summary
The pdf-lib module is not being found on Windows when the Electron app is packaged, despite being listed in devDependencies. This is causing the app to fail when trying to merge PDFs.

## Current State Analysis

### 1. pdf-lib Usage Locations
- **Main Process**: 
  - `src/main/services/EnhancedManuscriptDownloaderService.ts` - imports pdf-lib directly
  - `src/main/services/EnhancedPdfMerger.ts` - imports pdf-lib for PDF operations
  - `src/main/services/ElectronPdfMerger.ts` - uses EnhancedPdfMerger which needs pdf-lib

- **Renderer Process**:
  - `src/renderer/services/PdfRendererService.ts` - dynamically imports pdf-lib
  
- **Worker** (currently disabled):
  - `src/workers/pdf-worker.ts` - disabled, throws error to use main process instead

### 2. Package.json Configuration
- pdf-lib is in `devDependencies` (version ^1.17.1)
- This is the root cause - devDependencies are NOT bundled in production builds
- The previous fix attempt moved it to dependencies but increased build size significantly

### 3. Bundling Configuration
- Electron Builder uses `asar: true` which packages all files into an archive
- The `files` array includes `node_modules/**/*` but only for dependencies, not devDependencies
- TypeScript compiles to CommonJS for main process (`module: "CommonJS"`)
- Vite bundles renderer code separately with manual chunks for pdf-vendor

## Root Cause
pdf-lib is in devDependencies instead of dependencies, so it's not included in the production build. When the app tries to import pdf-lib in production, the module cannot be found.

## Solution Options

### Option 1: Move pdf-lib to dependencies (Simple but increases size)
```json
"dependencies": {
  "pdf-lib": "^1.17.1",
  // ... other deps
}
```
- Pros: Simple, guaranteed to work
- Cons: Increases build size (pdf-lib is ~1.5MB)

### Option 2: Bundle pdf-lib into main process code (Recommended)
Use a bundler for the main process to include pdf-lib in the compiled output:
1. Add esbuild or webpack configuration for main process
2. Bundle EnhancedPdfMerger.ts with pdf-lib embedded
3. This avoids shipping the entire pdf-lib package

### Option 3: Move PDF operations to renderer process
Since renderer already dynamically imports pdf-lib:
1. Move all PDF merging logic to renderer process
2. Use IPC only for file I/O operations
3. Leverage existing Vite bundling for pdf-lib

### Option 4: External bundling with webpack/esbuild
Create a separate bundle for pdf operations:
1. Bundle pdf-lib + EnhancedPdfMerger into a single file
2. Include this bundled file in the dist folder
3. Load it dynamically when needed

## Recommended Fix: Option 2 - Bundle pdf-lib into main process

### Implementation Plan
1. Install esbuild as devDependency
2. Create build script to bundle main process with pdf-lib
3. Modify build process to use bundled output
4. Test on Windows to ensure pdf-lib is found

### Why This Approach?
- Minimal build size increase (only includes used parts of pdf-lib)
- No changes to package structure
- Works reliably across all platforms
- Maintains current architecture

## Alternative Quick Fix
If immediate fix is needed, use Option 1 and move pdf-lib to dependencies. This is guaranteed to work but will increase build size.

## Implementation Complete

### What Was Done
1. ✅ Installed esbuild (already present in devDependencies)
2. ✅ Created `esbuild.main.config.js` to bundle main process with pdf-lib
3. ✅ Updated package.json scripts:
   - `build:main:bundled` - uses esbuild to bundle main process
   - `build` - now uses bundled build
   - `dev:main` and `dev:main:headless` - use bundled build in development
4. ✅ Tested the build - pdf-lib is successfully bundled (315 occurrences in output)
5. ✅ Verified build size - main.js is 2.0MB (reasonable for a bundled file)

### Key Configuration
The esbuild configuration:
- Bundles pdf-lib and other pure JS dependencies
- Keeps electron, canvas, jsdom, and jimp as external (native dependencies)
- Outputs CommonJS format for Node.js compatibility
- Minifies in production mode
- Includes source maps in development

### Results
- pdf-lib is now bundled directly into main.js
- No need to move pdf-lib to dependencies
- Build size increase is minimal (only pdf-lib code that's actually used)
- Windows builds should now work correctly without "module not found" errors

### Testing Required
1. Build Windows executable with `npm run dist:win`
2. Test PDF merging functionality on Windows
3. Verify no "pdf-lib module not found" errors occur