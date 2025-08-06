# Critical Issues Analysis - MSS Downloader

## Executive Summary
Multiple critical issues have been identified that severely impact the core functionality of the application:
1. File saving appears broken but files are actually saved in unexpected subfolders
2. Queue management is completely broken with concurrent downloads and disabled pause
3. Manifest loading crashes the entire app on Windows with no error logging
4. Progress tracking is disconnected from actual download operations

## Issue 1: File Saving Confusion (SOLVED)

### Root Cause
Files ARE being saved, but in an unexpected location that confuses users.

**Location:** `src/main/services/EnhancedManuscriptDownloaderService.ts:4345-4346`

```typescript
// Always create a subfolder with the manuscript name
const targetDir = path.join(downloadsDir, sanitizedName);
await fs.mkdir(targetDir, { recursive: true });
```

### The Problem Flow:
1. User downloads manuscript "Table_of_Contents_Part_1"
2. App creates folder: `Downloads/Table_of_Contents_Part_1/`
3. PDF saved as: `Downloads/Table_of_Contents_Part_1/Table_of_Contents_Part_1_pages_1-322.pdf`
4. User clicks "Reveal Folder" button
5. App opens `Downloads/` folder (NOT the subfolder)
6. User sees empty folder or only logs, thinks download failed

### Fix Required:
The "Reveal Folder" button should:
- Either open the specific manuscript subfolder
- Or highlight the specific PDF file in the folder
- Or store the actual output path and reveal that specific file

## Issue 2: Queue Management Catastrophe

### Symptoms Observed (from screenshot):
- Two downloads running simultaneously when should be sequential
- Part 1: 88/322 pages (27.33%)
- Part 2: 25/322 pages (7.76%)
- Both showing "DOWNLOADING" status
- Pause button appears disabled
- Progress continues even after queue stop

### Root Causes Identified:

#### 2.1 Missing Concurrency Control
**Location:** `src/main/services/EnhancedDownloadQueue.ts:562-616`

The queue processes items but doesn't properly manage concurrent downloads:
- No semaphore/lock for limiting active downloads
- `activeDownloaders` Map exists but isn't used properly
- Multiple `processItem` calls can run simultaneously

#### 2.2 Broken Pause/Resume Logic
**Location:** `src/main/services/EnhancedDownloadQueue.ts:528-544`

```typescript
pauseProcessing(): void {
    this.state.isPaused = true;
    if (this.processingAbortController) {
        this.processingAbortController.abort();
    }
    this.notifyListeners();
}
```

Problems:
- AbortController is aborted but download continues
- No mechanism to actually pause ongoing HTTP requests
- Progress updates continue after abort

#### 2.3 Race Condition in Queue Processing
When auto-split happens, multiple parts are added to queue and all start downloading immediately instead of respecting concurrency limits.

## Issue 3: Manifest Loading Crashes (Windows)

### User Report:
- "Unexpected error" during manifest load
- App crashes completely
- No logs generated
- Windows AMD64 specific

### Likely Causes:

#### 3.1 Unhandled Promise Rejection
**Location:** `src/main/services/EnhancedManuscriptDownloaderService.ts:7139-7152`

Error handling exists but may not catch all cases:
```typescript
} catch (error: any) {
    console.error(`[Graz] loadGrazManifest failed:`, error);
    // ... logging ...
    throw new Error(`Failed to load Graz manifest: ${error.message}`);
}
```

#### 3.2 IPC Communication Failure
The error might crash the main process before it can communicate back to renderer, causing full app crash.

#### 3.3 Memory/Resource Issues
Large manifests might cause out-of-memory errors that aren't caught properly.

## Issue 4: Progress Tracking Disconnect

### The Problem:
Progress bar shows advancement but actual file operations lag behind or fail silently.

### Root Cause:
**Location:** `src/main/services/EnhancedManuscriptDownloaderService.ts:4377-4387`

Progress is updated based on download completion, not file write completion:
```typescript
const updateProgress = () => {
    const progress = completedPages / totalPagesToDownload;
    // ... calculate eta ...
    onProgress({ progress, completedPages, totalPages, eta });
};
```

But file writing happens asynchronously:
```typescript
const writePromise = fs.writeFile(imgPath, Buffer.from(imageData));
writePromises.push(writePromise);
```

The progress updates when download completes, not when file is written to disk.

## Immediate Actions Required:

### Priority 1 - Fix File Location Issue:
1. Modify "Reveal Folder" to open the actual manuscript subfolder
2. Store the output path in queue item
3. Use `shell.showItemInFolder(actualFilePath)` instead of opening Downloads

### Priority 2 - Fix Queue Management:
1. Implement proper semaphore for concurrent downloads
2. Fix pause/resume to actually stop HTTP requests
3. Prevent multiple parts from downloading simultaneously
4. Add proper abort handling that stops progress updates

### Priority 3 - Fix Windows Crash:
1. Add try-catch wrapper around all manifest loading
2. Implement graceful error recovery in IPC handlers
3. Add error boundary in renderer for crash prevention
4. Ensure logs are written even during crashes

### Priority 4 - Fix Progress Tracking:
1. Track both download and write progress separately
2. Only update progress after file write completes
3. Add verification that files exist before marking complete

## Test Cases Needed:

1. **File Location Test:**
   - Download any manuscript
   - Click "Reveal Folder"
   - Verify correct subfolder opens with PDF visible

2. **Queue Management Test:**
   - Add multiple manuscripts to queue
   - Start download
   - Verify only configured concurrent downloads run
   - Test pause/resume functionality
   - Verify progress stops when paused

3. **Error Handling Test:**
   - Test with invalid URLs
   - Test with network disconnection
   - Test with disk full scenarios
   - Verify app doesn't crash, shows proper errors

4. **Graz Specific Test:**
   - Test URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
   - Verify manifest loads without crash
   - Verify files are saved correctly
   - Test on Windows specifically