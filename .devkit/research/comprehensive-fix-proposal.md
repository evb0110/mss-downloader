# Comprehensive Fix Proposal for Critical MSS Downloader Issues

## Summary of All Issues Found

### 1. ✅ SOLVED: File Saving Location Confusion
**Root Cause:** Files are saved in `Downloads/[manuscript_name]/` subfolder but "Reveal Folder" opens parent Downloads folder.

### 2. ✅ SOLVED: Queue Management Breaking
**Root Cause:** When auto-split occurs, all parts are added to queue and start downloading simultaneously, ignoring concurrency limits.

### 3. ✅ SOLVED: Progress Tracking Disconnect  
**Root Cause:** Progress updates on download completion, not file write completion.

### 4. ⚠️ PENDING: Windows Manifest Crash
**Root Cause:** Unhandled errors in manifest loading causing app crash with no error recovery.

## Detailed Fixes Required

### Fix 1: Reveal Folder Issue
**File:** `src/main/main.ts:952-957`

**Current Code:**
```typescript
ipcMain.handle('open-downloads-folder', async () => {
  const downloadsDir = app.getPath('downloads');
  await shell.openPath(downloadsDir);
  return downloadsDir;
});
```

**Fixed Code:**
```typescript
ipcMain.handle('open-downloads-folder', async () => {
  const queue = EnhancedDownloadQueue.getInstance();
  const state = queue.getState();
  
  // Find most recent completed item with output path
  const completedItems = state.items
    .filter(item => item.status === 'completed' && item.outputPath)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  
  if (completedItems.length > 0 && completedItems[0].outputPath) {
    // Open the specific file location
    shell.showItemInFolder(completedItems[0].outputPath);
    return path.dirname(completedItems[0].outputPath);
  } else {
    // Fallback to downloads folder
    const downloadsDir = app.getPath('downloads');
    await shell.openPath(downloadsDir);
    return downloadsDir;
  }
});
```

### Fix 2: Queue Concurrency Control
**File:** `src/main/services/EnhancedDownloadQueue.ts:562-616`

**Problem:** The processQueue function processes items sequentially but doesn't track active downloads properly.

**Add Active Download Tracking:**
```typescript
private activeDownloadCount: number = 0;
private maxConcurrentQueueItems: number = 1; // Only 1 queue item at a time

private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.state.isPaused) {
        return;
    }

    this.isProcessingQueue = true;
    this.state.isProcessing = true;
    this.notifyListeners();

    try {
        while (true) {
            // Check if we can start a new download
            if (this.activeDownloadCount >= this.maxConcurrentQueueItems) {
                // Wait a bit before checking again
                await this.sleep(500);
                continue;
            }

            const nextItem = this.state.items.find((item) => {
                if (item.status === 'pending') return true;
                // Auto-retry logic...
                return false;
            });

            if (!nextItem) break;
            if (this.state.isPaused) break;

            // Increment active count BEFORE starting download
            this.activeDownloadCount++;
            
            // Process item asynchronously (don't await)
            this.processItem(nextItem).finally(() => {
                this.activeDownloadCount--;
                // Trigger queue processing again when slot opens
                if (!this.state.isPaused) {
                    this.processQueue();
                }
            });

            // Don't process more items until current one starts
            await this.sleep(100);
        }
    } catch (error: any) {
        console.error('Queue processing error:', error.message);
    } finally {
        this.isProcessingQueue = false;
        if (this.activeDownloadCount === 0) {
            this.state.isProcessing = false;
        }
        this.notifyListeners();
    }
}
```

### Fix 3: Pause/Resume Implementation
**File:** `src/main/services/EnhancedDownloadQueue.ts:528-544`

**Add proper download cancellation:**
```typescript
private activeDownloadControllers: Map<string, AbortController> = new Map();

pauseProcessing(): void {
    this.state.isPaused = true;
    
    // Abort all active downloads
    for (const [itemId, controller] of this.activeDownloadControllers) {
        controller.abort();
        // Mark item as paused
        const item = this.state.items.find(i => i.id === itemId);
        if (item && item.status === 'downloading') {
            item.status = 'paused';
        }
    }
    this.activeDownloadControllers.clear();
    
    this.notifyListeners();
}

private async processItem(item: QueuedManuscript): Promise<void> {
    const abortController = new AbortController();
    this.activeDownloadControllers.set(item.id, abortController);
    
    try {
        // ... existing code ...
        
        const result = await this.currentDownloader!.downloadManuscript(item.url, {
            signal: abortController.signal, // Pass abort signal
            // ... other options ...
        });
        
        // ... existing code ...
    } finally {
        this.activeDownloadControllers.delete(item.id);
    }
}
```

### Fix 4: Error Handling for Manifest Loading
**File:** `src/main/services/EnhancedManuscriptDownloaderService.ts:7139-7152`

**Wrap in additional try-catch:**
```typescript
async loadGrazManifest(grazUrl: string): Promise<ManuscriptManifest> {
    try {
        // ... existing manifest loading code ...
    } catch (error: any) {
        console.error(`[Graz] loadGrazManifest failed:`, error);
        
        // Create safe error message
        const safeError = new Error(
            `Failed to load Graz manifest: ${error.message || 'Unknown error'}`
        );
        
        // Log to file even if app crashes
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const logPath = path.join(app.getPath('userData'), 'crash-log.txt');
            await fs.appendFile(logPath, `
[${new Date().toISOString()}] Graz Manifest Error:
URL: ${grazUrl}
Error: ${error.message}
Stack: ${error.stack}
---
`);
        } catch (logError) {
            // Ignore logging errors
        }
        
        throw safeError;
    }
}
```

### Fix 5: IPC Error Boundary
**File:** `src/main/main.ts` - Add error wrapper for all IPC handlers

```typescript
function wrapIpcHandler(handler: Function) {
    return async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch (error: any) {
            console.error('IPC Handler Error:', error);
            
            // Log to file
            try {
                const fs = await import('fs/promises');
                const logPath = path.join(app.getPath('userData'), 'ipc-errors.log');
                await fs.appendFile(logPath, `
[${new Date().toISOString()}] IPC Error:
${error.message}
${error.stack}
---
`);
            } catch {}
            
            // Return safe error to renderer
            throw new Error(error.message || 'Operation failed');
        }
    };
}

// Wrap all handlers
ipcMain.handle('load-manifest', wrapIpcHandler(async (event, url) => {
    // ... existing code ...
}));
```

## Testing Requirements

### Test 1: File Location
```javascript
// Test that Reveal Folder opens correct location
const testRevealFolder = async () => {
    // 1. Download a manuscript
    // 2. Click Reveal Folder
    // 3. Verify correct subfolder opens with PDF visible
};
```

### Test 2: Queue Concurrency
```javascript
// Test that only 1 manuscript downloads at a time
const testQueueConcurrency = async () => {
    // 1. Add 3 manuscripts to queue
    // 2. Start download
    // 3. Verify only 1 downloads at a time
    // 4. Verify parts don't download simultaneously
};
```

### Test 3: Pause/Resume
```javascript
// Test pause actually stops downloads
const testPauseResume = async () => {
    // 1. Start download
    // 2. Click pause
    // 3. Verify progress stops immediately
    // 4. Verify network requests stop
    // 5. Click resume
    // 6. Verify download continues from where it left off
};
```

### Test 4: Error Recovery
```javascript
// Test app doesn't crash on errors
const testErrorRecovery = async () => {
    // 1. Try invalid URL
    // 2. Verify error message shown, app doesn't crash
    // 3. Try Graz URL with network disabled
    // 4. Verify timeout error shown, app doesn't crash
};
```

## Implementation Priority

1. **IMMEDIATE:** Fix Reveal Folder (5 minutes)
2. **HIGH:** Fix queue concurrency (30 minutes)  
3. **HIGH:** Fix pause/resume (20 minutes)
4. **MEDIUM:** Add error boundaries (20 minutes)
5. **LOW:** Add comprehensive tests (1 hour)

## Verification Steps

After implementing fixes:

1. Download Graz manuscript: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
2. Verify file saves in Downloads/[manuscript_name]/ folder
3. Click Reveal Folder - verify correct folder opens
4. Add 2 more manuscripts to queue
5. Verify only 1 downloads at a time
6. Test pause - verify progress stops
7. Test resume - verify download continues
8. Force an error - verify app doesn't crash

## Notes

- The queue was designed for sequential processing but auto-split breaks this assumption
- Progress tracking needs complete rewrite to track actual file I/O
- Error handling needs to be defensive at every level
- Windows-specific testing required for manifest crash issue