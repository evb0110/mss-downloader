# Manuscripta.at Hanging and Page Range Issues Analysis

**Date:** June 29, 2025  
**Issue URL:** https://manuscripta.at/diglit/AT5000-963/0001  
**Problem:** Hanging at page 437 of 782, page range selection not working  

## Executive Summary

After comprehensive analysis of the Manuscripta.at implementation, I found **TWO CRITICAL BUGS**:

1. **Hanging Issue**: The page range filtering logic in `loadViennaManuscriptaManifest()` is incorrectly applied, causing downloads starting from a specific page to hang
2. **Page Range Selection Not Working**: The UI allows page range input, but the implementation ignores user-specified ranges and always downloads from the URL's page number to the end

## Problem Analysis

### Issue #1: Page Range Filtering Bug in Manifest Loading

**Location:** `/src/main/services/EnhancedManuscriptDownloaderService.ts:4218-4226`

**Current Buggy Code:**
```typescript
if (startPage !== null) {
    const pageIndex = startPage - 1; // Convert to 0-based index
    if (pageIndex >= 0 && pageIndex < pageLinks.length) {
        filteredPageLinks = pageLinks.slice(pageIndex);
        console.log(`Vienna Manuscripta: Filtered to ${filteredPageLinks.length} pages starting from page ${startPage}`);
    } else {
        console.warn(`Vienna Manuscripta: Requested page ${startPage} is out of range (1-${pageLinks.length})`);
    }
}
```

**Problem:** When URL contains `/0437`, `startPage` is set to 437, and `pageLinks.slice(436)` creates an array starting from page 437 to the end (346 pages). However, the download loop still tries to download 782 pages but only has 346 URLs, causing hanging after page 437.

### Issue #2: Page Range Selection Ignored

**Location:** Multiple places in download flow

**Current Implementation:**
- URL parsing extracts page number: `/0437` → `startPage = 437`
- User can input `startPage: 450, endPage: 500` in UI
- But the manifest loading **ignores user input** and only uses URL page number
- Download logic doesn't properly handle user-specified `endPage`

## Technical Details

### IIIF Manifest Structure
- **AT5000-963** has 782 pages total (verified via IIIF manifest)
- Page 437 exists and has valid image URL: `AT5000-963_217r.jpg`
- Page 438 exists and has valid image URL: `AT5000-963_217v.jpg`
- No missing pages or gaps in numbering

### Current Download Logic Flow
1. `loadViennaManuscriptaManifest()` extracts `startPage` from URL
2. Slices `pageLinks` array from `startPage` to end
3. Returns manifest with reduced `pageLinks` array
4. `downloadManuscript()` calculates `totalPagesToDownload` using original total pages
5. **Mismatch**: Loop expects 782 pages but only has 346 URLs → hanging

### Download Loop Analysis
**Location:** `/src/main/services/EnhancedManuscriptDownloaderService.ts:1862-1866`

```typescript
while (nextPageIndex < actualEndPage) {
    const idx = nextPageIndex++;
    await downloadPage(idx);
}
```

- `actualEndPage` = 782 (from original manifest)
- `pageLinks` array length = 346 (filtered in manifest loading)
- Loop continues beyond available URLs → hanging

## Root Cause Summary

1. **Manifest Loading**: Incorrectly filters `pageLinks` based on URL page number
2. **Page Range Logic**: Doesn't properly integrate user-specified ranges
3. **Download Loop**: Uses original page count with filtered URL array
4. **UI Disconnect**: User range inputs aren't passed to manifest loading

## Impact

- **URLs with page numbers**: Always hang after reaching the URL's page number
- **Page range selection**: Completely non-functional
- **User experience**: Cannot download specific page ranges as intended

## Solution Requirements

1. **Fix manifest loading**: Don't pre-filter `pageLinks` array
2. **Implement proper page range handling**: Use user inputs for actual filtering
3. **Fix download loop**: Use correct page bounds based on actual URLs to download
4. **Integrate UI inputs**: Pass user page ranges to manifest loading logic

## Test Cases for Verification

1. **Full manuscript**: `https://manuscripta.at/diglit/AT5000-963` → Should download all 782 pages
2. **URL with page**: `https://manuscripta.at/diglit/AT5000-963/0437` → Should download pages 437-782
3. **Custom range**: URL + user input (450-500) → Should download pages 450-500 only
4. **Single page**: User input (437-437) → Should download page 437 only

## Next Steps

1. **Remove pre-filtering** from `loadViennaManuscriptaManifest()`
2. **Implement proper page range logic** in `downloadManuscript()`
3. **Fix UI integration** to pass user ranges to download service
4. **Add comprehensive tests** for all page range scenarios
5. **Verify fix** with hanging URL: `https://manuscripta.at/diglit/AT5000-963/0001`

## Files to Modify

1. `/src/main/services/EnhancedManuscriptDownloaderService.ts` - Main download logic
2. `/src/renderer/components/DownloadQueueManager.vue` - UI page range handling  
3. `/src/main/services/EnhancedDownloadQueue.ts` - Queue options passing
4. `/tests/e2e/vienna-manuscripta.spec.ts` - Add page range tests

This analysis confirms that the hanging and page range issues are related bugs in the same codebase area, requiring coordinated fixes across the download pipeline.