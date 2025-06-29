# Orleans URL Hanging Investigation Report

## Issue Summary
Orleans URLs are hanging during the downloadSinglePage method, causing downloads to fail.

## Root Cause Analysis
After investigating the `downloadSinglePage` method implementations, I found:

### 1. Missing Orleans Headers
The `downloadSinglePage` method in `EnhancedDownloadQueue.ts` and `fetchDirect` method in `EnhancedManuscriptDownloaderService.ts` had headers for:
- ✅ ISOS (isos.dias.ie)
- ✅ Cambridge CUDL (images.lib.cam.ac.uk)
- ❌ **Orleans (missing!)**

### 2. Incorrect Orleans Domain
Orleans uses the `aurelia.orleans.fr` subdomain for API calls, not `mediatheques.orleans.fr`.

### 3. Insufficient Timeouts
Orleans IIIF service appears to be slow, similar to Trinity Cambridge, but was using default 30-second timeouts.

## Solution Applied

### Enhanced Headers for Orleans
Added Orleans-specific headers to both download methods:

```typescript
// Special headers for Orleans IIIF to avoid timeout/hanging issues
if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) {
    headers = {
        ...headers,
        'Referer': 'https://aurelia.orleans.fr/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
    };
}
```

### Extended Timeouts for Orleans
Increased timeout from 30 seconds to 60 seconds for Orleans URLs:

```typescript
const timeout = url.includes('mss-cat.trin.cam.ac.uk') ? 120000 : 
               (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) ? 60000 : 
               30000; // 2 minutes for Trinity Cambridge, 1 minute for Orleans, 30s default
```

## Files Modified
1. `/src/main/services/EnhancedManuscriptDownloaderService.ts` (lines 305-318, 272-274)
2. `/src/main/services/EnhancedDownloadQueue.ts` (lines 1005-1018, 972-974)

## Testing Status
- ❌ Orleans manifest loading still hanging after 45+ seconds
- ❓ Issue may be in Orleans API search/manifest loading phase, not image download phase
- ❓ Need further investigation into Orleans API response times and search functionality

## Next Steps if Issue Persists
1. Investigate Orleans API search timeout issues
2. Check if Orleans search queries are correct
3. Consider adding retry logic for Orleans API calls
4. Test with different Orleans manuscript URLs

## Related Files
- Tests: `tests/e2e/orleans-*.spec.ts`
- Debug script: `debug-orleans.js`