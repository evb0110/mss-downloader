# Phase 1: Core Fix - Add PageLinks Parameter Support

## Objective
Modify `EnhancedManuscriptDownloaderService.downloadManuscript()` to accept and use pre-sliced pageLinks from the queue instead of always re-loading the full manifest.

## Implementation Steps

### Step 1.1: Enhance Method Signature
**File:** `src/main/services/EnhancedManuscriptDownloaderService.ts`
**Line:** 4264-4272

**Current:**
```typescript
async downloadManuscript(url: string, options: any = {}): Promise<any> {
    const {
        onProgress = () => {},
        onManifestLoaded = () => {},
        maxConcurrent = configService.get('maxConcurrentDownloads'),
        skipExisting = false,
        startPage,
        endPage,
    } = options;
```

**Change to:**
```typescript
async downloadManuscript(url: string, options: any = {}): Promise<any> {
    const {
        onProgress = () => {},
        onManifestLoaded = () => {},
        maxConcurrent = configService.get('maxConcurrentDownloads'),
        skipExisting = false,
        startPage,
        endPage,
        // NEW: Accept pre-processed data from queue
        pageLinks,
        displayName,
        library,
        totalPages,
        queueItem,
    } = options;
```

### Step 1.2: Conditional Manifest Loading
**Line:** 4282

**Current:**
```typescript
manifest = await this.loadManifest(url);
```

**Change to:**
```typescript
// Use provided pageLinks if available, otherwise load manifest
if (pageLinks && Array.isArray(pageLinks) && pageLinks.length > 0) {
    // Build manifest from pre-sliced data
    manifest = {
        pageLinks: pageLinks,
        totalPages: totalPages || pageLinks.length,
        library: library || 'unknown',
        displayName: displayName || 'manuscript',
        originalUrl: url,
        // Preserve any special metadata from queueItem
        ...(queueItem?.partInfo ? { partInfo: queueItem.partInfo } : {}),
        ...(queueItem?.tileConfig ? { tileConfig: queueItem.tileConfig } : {}),
        ...(queueItem?.requiresTileProcessor ? { requiresTileProcessor: queueItem.requiresTileProcessor } : {}),
    };
    console.log(`Using pre-sliced pageLinks for ${displayName}: ${pageLinks.length} pages`);
} else {
    // Existing behavior: load manifest from URL
    manifest = await this.loadManifest(url);
}
```

### Step 1.3: Fix Page Range Calculation
**Line:** 4321-4323

**Current:**
```typescript
const actualStartPage = Math.max(1, startPage || manifest.startPageFromUrl || 1);
const actualEndPage = Math.min(manifest.totalPages, endPage || manifest.totalPages);
```

**Change to:**
```typescript
// When using pre-sliced pageLinks, pages are already selected
const actualStartPage = pageLinks ? 1 : Math.max(1, startPage || manifest.startPageFromUrl || 1);
const actualEndPage = pageLinks ? manifest.totalPages : Math.min(manifest.totalPages, endPage || manifest.totalPages);
```

### Step 1.4: Fix Page Indexing
**Line:** 4423-4434

**Current:**
```typescript
const manifestIndex = pageIndex - (actualStartPage - 1);
if (manifestIndex < 0 || manifestIndex >= manifest.pageLinks.length) {
    console.error(`Page index ${pageIndex + 1} (manifest index ${manifestIndex}) is out of bounds`);
    failedPages.push(pageIndex + 1);
    completedPages++;
    updateProgress();
    return;
}
let imageUrl = manifest.pageLinks[manifestIndex];
```

**Change to:**
```typescript
// When using pre-sliced pageLinks, index directly
const manifestIndex = pageLinks ? pageIndex : (pageIndex - (actualStartPage - 1));
if (manifestIndex < 0 || manifestIndex >= manifest.pageLinks.length) {
    console.error(`Page index ${pageIndex + 1} (manifest index ${manifestIndex}) is out of bounds`);
    failedPages.push(pageIndex + 1);
    completedPages++;
    updateProgress();
    return;
}
let imageUrl = manifest.pageLinks[manifestIndex];
```

## Validation Points
1. Method remains backward compatible (all existing calls continue to work)
2. Pre-sliced pageLinks are properly used when provided
3. Page indexing is correct for both scenarios
4. Special metadata (tileConfig, etc.) is preserved

## Testing Requirements
1. Direct download without pageLinks (existing behavior)
2. Queue download with pre-sliced pageLinks (new behavior)
3. Verify correct pages are downloaded for split parts
4. Check that manifest metadata is preserved