# Manuscript Splitting Bug - Reproduction Test Results

## Summary
Successfully reproduced the critical bug where all manuscript parts download the same pages instead of their designated page ranges.

## Bug Description
When a large manuscript is auto-split into parts, all parts download pages 1-N instead of their specific ranges (e.g., Part 2 should download pages 84-166 but downloads pages 1-247).

## Root Cause
The issue occurs in the interaction between `DownloadQueue` and `ManuscriptDownloaderService`:

1. **DownloadQueue correctly slices pageLinks** (line 563):
   ```typescript
   const selectedPageLinks = manifest.pageLinks.slice(startPage - 1, endPage);
   ```

2. **Queue passes selectedPageLinks to downloader**:
   ```typescript
   await this.currentDownloader.downloadManuscriptPagesWithOptions(selectedPageLinks, options);
   ```

3. **BUT: ManuscriptDownloaderService ignores selectedPageLinks**:
   - It calls `this.parseManuscriptUrl(url)` instead of using provided pageLinks
   - This re-loads the FULL manifest with ALL pages
   - Result: All parts download identical content (pages 1-N)

## Test Results

### Graz Manuscript (247 pages split into 3 parts)
- **Part 1**: Should download pages 1-83, actually downloads pages 1-247
- **Part 2**: Should download pages 84-166, actually downloads pages 1-247  
- **Part 3**: Should download pages 167-247, actually downloads pages 1-247

### Vatican Manuscript (156 pages split into 2 parts)
- **Part 1**: Should download pages 1-78, actually downloads pages 1-156
- **Part 2**: Should download pages 79-156, actually downloads pages 1-156

## Evidence
The test script shows clear URL differences:
- **Correct Part 2 URLs**: `page_84_id` to `page_166_id` 
- **Actual Part 2 URLs**: `page_1_id` to `page_247_id` (same as Part 1 and Part 3)

## Proposed Solution
1. Modify `ManuscriptDownloaderService.downloadManuscriptPagesWithOptions()` to accept pre-sliced pageLinks
2. Skip manifest re-loading when pageLinks are provided
3. Use the provided selectedPageLinks directly instead of calling parseManuscriptUrl()

## Files Involved
- **Primary Bug Location**: `src/main/services/DownloadQueue.ts` (line 563 - slicing works correctly)
- **Fix Required**: `src/main/services/ManuscriptDownloaderService.ts` (needs to use provided pageLinks)
- **Test Script**: `.devkit/testing/reproduce-split-bug.js`

## Impact
This bug causes:
- Massive storage waste (downloading same content multiple times)
- Incorrect PDF parts (all parts contain identical pages 1-N)
- User confusion when parts don't contain expected page ranges
- Potential server overload from unnecessary duplicate downloads

## Test Usage
```bash
node .devkit/testing/reproduce-split-bug.js
```

The script demonstrates the exact page ranges each part should get vs. what they actually download, proving the bug conclusively.