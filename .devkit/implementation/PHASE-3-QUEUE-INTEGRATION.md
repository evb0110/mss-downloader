# Phase 3: Queue Integration - Pass Pre-Sliced PageLinks

## Objective
Modify EnhancedDownloadQueue to pass pre-sliced pageLinks to the downloader service, preventing manifest re-loading.

## Implementation Steps

### Step 3.1: Modify EnhancedDownloadQueue processItem
**File:** `src/main/services/EnhancedDownloadQueue.ts`
**Lines:** 795-807

**Current:**
```typescript
const result = await this.currentDownloader!.downloadManuscript(item.url, {
    onProgress: (progress: DownloadProgress) => {
        // ... progress handling
    },
    onManifestLoaded: (manifest: ManuscriptManifest) => {
        // ... manifest handling
    },
    maxConcurrent: item.libraryOptimizations?.maxConcurrentDownloads || 
                   this.state.globalSettings.concurrentDownloads,
    skipExisting: false,
    startPage: item.downloadOptions?.startPage,
    endPage: item.downloadOptions?.endPage,
    queueItem: item,
});
```

**Change to:**
```typescript
// Pre-load manifest and slice pageLinks for parts
let pageLinksToPass = null;
let manifestMetadata = {};

if (item.isAutoPart && item.downloadOptions?.startPage && item.downloadOptions?.endPage) {
    // For auto-split parts, we need to slice the pageLinks
    console.log(`Processing auto-split part: ${item.displayName}`);
    console.log(`Page range: ${item.downloadOptions.startPage}-${item.downloadOptions.endPage}`);
    
    // Load manifest once to get pageLinks
    const fullManifest = await this.currentDownloader!.loadManifest(item.url);
    
    // Slice the pageLinks for this part
    const startIdx = item.downloadOptions.startPage - 1;
    const endIdx = item.downloadOptions.endPage;
    pageLinksToPass = fullManifest.pageLinks.slice(startIdx, endIdx);
    
    console.log(`Sliced ${pageLinksToPass.length} pages from full manifest (${fullManifest.totalPages} total)`);
    
    // Preserve manifest metadata
    manifestMetadata = {
        library: fullManifest.library,
        displayName: item.displayName,
        totalPages: pageLinksToPass.length,
        originalUrl: item.url,
        // Preserve special processing flags
        requiresTileProcessor: fullManifest.requiresTileProcessor,
        tileConfig: fullManifest.tileConfig,
        pageBlocks: fullManifest.pageBlocks,
    };
}

const result = await this.currentDownloader!.downloadManuscript(item.url, {
    onProgress: (progress: DownloadProgress) => {
        // ... existing progress handling
    },
    onManifestLoaded: (manifest: ManuscriptManifest) => {
        // ... existing manifest handling
    },
    maxConcurrent: item.libraryOptimizations?.maxConcurrentDownloads || 
                   this.state.globalSettings.concurrentDownloads,
    skipExisting: false,
    // NEW: Pass pre-sliced pageLinks for parts
    ...(pageLinksToPass ? {
        pageLinks: pageLinksToPass,
        ...manifestMetadata,
        // Don't pass startPage/endPage when using pre-sliced
    } : {
        // Original behavior for non-parts
        startPage: item.downloadOptions?.startPage,
        endPage: item.downloadOptions?.endPage,
    }),
    queueItem: item,
});
```

### Step 3.2: Update Legacy DownloadQueue (Same Pattern)
**File:** `src/main/services/DownloadQueue.ts`
**Lines:** 559-599

Apply the same pattern to the legacy queue for consistency.

### Step 3.3: Ensure Manifest is Loaded Only Once
Add caching to prevent multiple manifest loads for the same URL:

```typescript
// At class level
private manifestLoadPromises = new Map<string, Promise<ManuscriptManifest>>();

// In processItem
let fullManifest;
if (this.manifestLoadPromises.has(item.url)) {
    fullManifest = await this.manifestLoadPromises.get(item.url);
} else {
    const loadPromise = this.currentDownloader!.loadManifest(item.url);
    this.manifestLoadPromises.set(item.url, loadPromise);
    fullManifest = await loadPromise;
    // Clean up after some time
    setTimeout(() => this.manifestLoadPromises.delete(item.url), 60000);
}
```

## Critical Validation Points

1. **Part Detection**
   - Correctly identify auto-split parts (`item.isAutoPart`)
   - Verify page range is properly set

2. **Page Slicing**
   - Ensure correct slice indices (0-based)
   - Verify slice produces expected page count

3. **Metadata Preservation**
   - Library type must be preserved
   - Special flags (tileConfig, etc.) must be passed

4. **Progress Reporting**
   - Progress should reflect actual pages being downloaded
   - Not the full manuscript pages

## Testing Requirements

1. **Split Manuscript Test**
   - Create 3-part split
   - Verify each part gets different pageLinks
   - Check first and last page URLs for each part

2. **Direct Download Test**
   - Ensure non-split downloads still work
   - Verify page range selection works

3. **Memory Test**
   - Check manifest caching doesn't cause memory leak
   - Verify cleanup after download

## Expected Behavior

### Before Fix:
```
Part 1: manifest.pageLinks[0] to manifest.pageLinks[246] (full manifest)
Part 2: manifest.pageLinks[0] to manifest.pageLinks[246] (full manifest) 
Part 3: manifest.pageLinks[0] to manifest.pageLinks[246] (full manifest)
```

### After Fix:
```
Part 1: pageLinks[0] to pageLinks[82] (sliced from indices 0-82)
Part 2: pageLinks[0] to pageLinks[82] (sliced from indices 83-165)
Part 3: pageLinks[0] to pageLinks[80] (sliced from indices 166-246)
```

## Error Handling

```typescript
if (pageLinksToPass && pageLinksToPass.length === 0) {
    throw new Error(`Page slicing resulted in empty array for ${item.displayName}`);
}

if (item.isAutoPart && !item.downloadOptions?.startPage) {
    throw new Error(`Auto-part ${item.displayName} missing startPage`);
}
```