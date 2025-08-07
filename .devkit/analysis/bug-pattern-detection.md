# Bug Pattern Detection: Manuscript Parts Downloading Same Pages

## Critical Bug Found

The bug where manuscript parts are all downloading the same pages occurs because both downloader services **re-load the full manifest instead of using the pre-sliced pageLinks** passed from the queue.

## Exact Bug Locations

### 1. EnhancedManuscriptDownloaderService.ts - Line 4282

**File:** `/home/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts`

**Line 4282:** `manifest = await this.loadManifest(url);`

**Problem:** The `downloadManuscript()` method ignores the `queueItem` parameter that contains pre-selected page ranges and always loads the full manifest.

```typescript
// Line 4264-4272: Method signature extracts startPage/endPage but NOT queueItem
async downloadManuscript(url: string, options: any = {}): Promise<any> {
    const {
        onProgress = () => {},
        onManifestLoaded = () => {},
        maxConcurrent = configService.get('maxConcurrentDownloads'),
        skipExisting = false,
        startPage,        // ✅ Extracted
        endPage,          // ✅ Extracted
        // queueItem,     // ❌ NOT EXTRACTED - passed but ignored!
    } = options;

    // Lines 4281-4282: Always loads full manifest, ignoring pre-selected pages
    const manifestStartTime = Date.now();
    manifest = await this.loadManifest(url);  // ❌ BUG: Re-loads full manifest
```

**What should happen:** Use pre-sliced pageLinks from `queueItem` when available instead of re-loading the full manifest.

### 2. EnhancedDownloadQueue.ts - Lines 802 and 1754

**File:** `/home/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedDownloadQueue.ts`

**Lines 802 and 1754:** The queue correctly passes `queueItem: item` but the downloader ignores it.

```typescript
// Lines 799-802: Queue passes queueItem with page ranges
startPage: item.downloadOptions?.startPage,
endPage: item.downloadOptions?.endPage,
// Pass the queue item for manual manifest data
queueItem: item,  // ✅ Correctly passed but ignored by downloader
```

### 3. ManuscriptDownloaderService.ts - Line 121

**File:** `/home/evb/WebstormProjects/mss-downloader/src/main/services/ManuscriptDownloaderService.ts`

**Line 121:** `const manifest = await this.parseManuscriptUrl(url);`

**Problem:** The legacy service also always parses the full manuscript URL instead of using pre-selected pages.

```typescript
// Line 117-121: Always loads full manifest
async downloadManuscript(url: string, callbacks?: DownloadCallbacks): Promise<void> {
    try {
        callbacks?.onStatusChange?.({ phase: 'parsing', message: 'Parsing manuscript URL...' });
        
        const manifest = await this.parseManuscriptUrl(url);  // ❌ BUG: Always loads full
```

## Bug Pattern Analysis

### Pattern 1: Parameter Ignored
- ✅ **EnhancedDownloadQueue** passes `queueItem` parameter containing page ranges
- ❌ **EnhancedManuscriptDownloaderService** doesn't extract `queueItem` from options
- ❌ **EnhancedManuscriptDownloaderService** calls `this.loadManifest(url)` regardless

### Pattern 2: Manifest Re-loading
- Line 4282: `manifest = await this.loadManifest(url);` - Always loads full manifest
- Line 4426: `if (manifestIndex < 0 || manifestIndex >= manifest.pageLinks.length)` - Uses full pageLinks array
- Line 4434: `let imageUrl = manifest.pageLinks[manifestIndex];` - Accesses full pageLinks instead of pre-selected ones

### Pattern 3: Range Calculation Issues
- Lines 4321-4323: Calculates `actualStartPage`/`actualEndPage` from options
- Line 4423: Maps `pageIndex` to `manifestIndex` assuming full manifest
- **Problem:** The mapping assumes the manifest starts from page 1, but parts should use a different indexing

## All Affected Methods

### EnhancedManuscriptDownloaderService.ts
1. **`downloadManuscript()`** - Line 4264 - Ignores queueItem parameter
2. **Page download loop** - Lines 4420-4434 - Uses `manifest.pageLinks[manifestIndex]` directly

### ManuscriptDownloaderService.ts  
1. **`downloadManuscript()`** - Line 117 - Always parses full URL
2. **`downloadImagesWithProgress()`** - Line 125 - Uses `manifest.pageLinks` directly

### EnhancedDownloadQueue.ts
1. **`processItem()`** - Line 773 - Passes `queueItem` but ignored
2. **`processItemConcurrently()`** - Line 1725 - Passes `queueItem` but ignored

## Root Cause Summary

The bug occurs because:

1. **EnhancedDownloadQueue** correctly splits manuscripts into parts with specific page ranges
2. **Queue passes** `queueItem` containing the pre-selected page ranges to the downloader
3. **EnhancedManuscriptDownloaderService** ignores the `queueItem` parameter completely
4. **Downloader always calls** `this.loadManifest(url)` which loads the full manuscript
5. **All parts download** the same full page set instead of their assigned ranges

## Fix Requirements

1. **Extract `queueItem` from options** in downloadManuscript method signature
2. **Check if queueItem has pre-selected pageLinks** before calling loadManifest
3. **Use pre-selected pageLinks** when available instead of loading full manifest
4. **Adjust page indexing logic** to work with partial page ranges

## Code Snippets of Problematic Patterns

```typescript
// ❌ WRONG: Always re-loads manifest
manifest = await this.loadManifest(url);

// ❌ WRONG: Uses full manifest pageLinks
let imageUrl = manifest.pageLinks[manifestIndex];

// ❌ WRONG: Doesn't extract queueItem
const { startPage, endPage } = options;  // Missing queueItem

// ✅ CORRECT: Should check for pre-selected pages first
if (queueItem && queueItem.selectedPageLinks) {
    // Use pre-selected pages
} else {
    manifest = await this.loadManifest(url);
}
```