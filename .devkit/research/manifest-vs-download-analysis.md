# Florence ContentDM: Manifest Loading vs Download Process Analysis

## Problem Summary

Florence ContentDM manuscripts show a clear discrepancy:
- **HEAD requests during manifest loading**: SUCCESS (200 OK)
- **GET requests during download**: 403 FORBIDDEN (after a few pages)
- **Same URLs, same size parameters**: All using 4000px width IIIF
- **Different outcomes**: Suggests server treats HEAD vs GET requests differently

## Key Findings from Code Analysis

### 1. Manifest Loading Phase (FlorenceLoader.ts)

**HTTP Method**: HEAD requests only
**Location**: `FlorenceLoader.ts` lines 53-74 (`testImageSize` method)
**Headers Used**:
```javascript
{
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'image/*',
    'Referer': 'https://cdm21059.contentdm.oclc.org/'
}
```

**Purpose**: Test image size availability using HEAD requests to determine optimal resolution (6000px → 4000px → 2048px → 1024px → 800px)

**Success Pattern**: HEAD requests to IIIF URLs succeed, allowing size determination

### 2. Download Phase (EnhancedDownloadQueue.ts)

**HTTP Method**: GET requests for actual image data
**Location**: `EnhancedDownloadQueue.ts` lines 1686+ (`downloadSinglePage` method)
**Headers Used**:
```javascript
{
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'image/*,*/*',
    'Accept-Language': 'en-US,en;q=0.5'
}
```

**Critical Finding**: **NO special Florence/ContentDM headers in download phase**

## Header Comparison Analysis

| Header | Manifest (HEAD) | Download (GET) | Impact |
|--------|-----------------|----------------|--------|
| User-Agent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` | **Different OS/Browser** |
| Accept | `image/*` | `image/*,*/*` | Minor difference |
| Referer | `https://cdm21059.contentdm.oclc.org/` | **MISSING** | **CRITICAL** |
| Accept-Language | **Not set** | `en-US,en;q=0.5` | Potentially problematic |

## ContentDM Server Behavior Analysis

### 1. HEAD vs GET Request Treatment
ContentDM servers likely implement different authorization logic for:
- **HEAD requests**: Allowed for metadata/availability checking
- **GET requests**: Require proper session/referer validation for bulk downloads

### 2. Rate Limiting Patterns
**Current Download Behavior**:
- Multiple concurrent GET requests without proper headers
- No delays between requests
- Missing ContentDM-specific session handling

**ContentDM Likely Expects**:
- Proper referer from the ContentDM domain
- Limited concurrency (1-2 simultaneous connections)
- Delays between requests (rate limiting)
- Consistent session/browser-like behavior

## Network Configuration Differences

### EnhancedManuscriptDownloaderService.ts Settings

**Florence-Specific Network Config** (lines 1752-1764):
```javascript
// Florence ContentDM specific settings:
maxSockets: 3,              // Reduced concurrent connections
maxFreeSockets: 1,          // Minimal free sockets  
keepAliveMsecs: 60000,      // Longer keep-alive for stability
timeout: 60000,             // 60s timeout for faster recovery
scheduling: 'fifo'          // Predictable connection scheduling
```

**Problem**: These settings apply to the `fetchWithHTTPS` method used in manifest loading, but **NOT** to the `downloadSinglePage` method in the download queue.

## Root Cause Identified

### 1. Missing Headers in Download Phase
The download queue's `downloadSinglePage` method lacks Florence-specific headers:
```javascript
// MISSING in download phase:
'Referer': 'https://cdm21059.contentdm.oclc.org/'
```

### 2. Different User-Agent Patterns
- **Manifest**: macOS Safari-like
- **Download**: Windows Chrome-like
- **Impact**: Server may flag this as suspicious bot behavior

### 3. No Rate Limiting for ContentDM
Unlike ISOS and CUDL which have special header handling, ContentDM has no download-phase protection.

## ContentDM-Specific Requirements Research

### Florence ContentDM Server Analysis (Based on Research)

**Domain**: `cdm21059.contentdm.oclc.org`
**Current Optimizations**: Already has special handling for Florence:
- **maxConcurrentDownloads**: 2 (reduced from 3 to prevent 403 errors)
- **timeoutMultiplier**: 2.5 (increased for ContentDM server delays)  
- **enableProgressiveBackoff**: true
- **autoSplitThresholdMB**: 300 (lower threshold for ContentDM stability)
- **requestDelayMs**: 1500 (1.5-second delay between requests for rate limiting)

### Known ContentDM Behavioral Patterns:
1. **Size limits**: Hard 4200px width limit + 200% scaling limit
2. **Session-based access**: Requires consistent referer headers
3. **Rate limiting**: 1.5-second delays already configured
4. **IP-based geo-blocking**: Enhanced for non-Italian IPs
5. **Progressive blocking**: Allows first few requests, then blocks
6. **Header validation**: Strict referer and User-Agent checking

### ContentDM Network Configuration (Already Applied):
- **Connection pooling**: 3 max sockets, 1 free socket
- **Keep-alive**: 60 seconds for stability
- **FIFO scheduling**: Predictable connection handling
- **DNS pre-resolution**: Avoids resolution timeouts
- **Special error handling**: Custom timeout messages for Florence

### Critical Finding: Download Queue Missing ContentDM Headers
While the manifest service has Florence-specific network settings, the **download queue lacks ContentDM headers**.

## Implementation Recommendations

### 1. Add Florence-Specific Headers to Download Queue

**Location**: `EnhancedDownloadQueue.ts` lines 1705-1728
**Add ContentDM header block**:
```javascript
// Special headers for Florence ContentDM to avoid 403 Forbidden errors
if (url.includes('cdm21059.contentdm.oclc.org')) {
    headers = {
        ...headers,
        'Referer': 'https://cdm21059.contentdm.oclc.org/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', // Match manifest phase
        'Accept': 'image/*',  // Match manifest phase
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
}
```

### 2. Apply Existing Rate Limiting from LibraryOptimizationService

**Current Status**: Florence already has `requestDelayMs: 1500` configured, but this may not be applied in download queue.

**Action Needed**: Verify the download queue respects the `requestDelayMs` setting from LibraryOptimizationService.

### 3. Utilize Existing Concurrency Limits

**Current Status**: Florence already has `maxConcurrentDownloads: 2` configured.
**No Changes Needed**: This should already be limiting downloads to 2 concurrent requests.

### 4. Consistent Session Headers

**CRITICAL**: Ensure all ContentDM requests (both manifest and download) use identical headers:
- **User-Agent**: Change download queue to match manifest: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36`
- **Accept**: Change download queue to match manifest: `image/*` (remove `,*/*`)
- **Referer**: Add to download queue: `https://cdm21059.contentdm.oclc.org/`

## Testing Plan

### 1. Header Consistency Test
Test with identical headers between manifest and download phases:
```bash
# Test URL: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/4000,/0/default.jpg
# Headers: Exact match with manifest phase
```

### 2. Rate Limiting Test  
Test with progressive delays:
- 0.5s, 1s, 2s, 5s between requests
- Monitor success rates

### 3. Concurrency Test
Test with different connection limits:
- 1 connection (safest)
- 2 connections (potentially acceptable)
- 3+ connections (likely to trigger blocks)

### 4. Session Consistency Test
Maintain identical browser signature throughout entire manuscript download.

## Expected Outcome

With proper ContentDM-specific handling:
1. **Consistent headers**: Same as successful manifest phase
2. **Rate limiting**: 2-3 seconds between requests
3. **Single connection**: Avoid overwhelming ContentDM servers
4. **Session consistency**: Identical browser signature throughout

**Result**: Should eliminate 403 Forbidden errors during bulk downloads while maintaining the successful manifest loading behavior.

---

## Additional Research Insights

### Size Parameter Issue (From ContentDM Research)
**MAJOR FINDING**: The current FlorenceLoader may be using size parameters that exceed ContentDM limits:
- **ContentDM Hard Limit**: 4200px maximum width
- **ContentDM Scale Limit**: 200% of original size
- **Current Implementation**: Uses intelligent sizing but may still request oversized images

**Recommendation**: Verify the FlorenceLoader's `determineOptimalSize` method respects the 4200px ContentDM limit.

### Network Configuration Already Optimized
The EnhancedManuscriptDownloaderService already has comprehensive Florence optimizations:
- DNS pre-resolution for `cdm21059.contentdm.oclc.org`
- Custom connection pooling (3 max sockets, 1 free)
- Extended keep-alive (60 seconds)
- Custom error messages for Florence timeouts
- FIFO connection scheduling

**This suggests the 403 errors are primarily due to missing headers in the download phase, not network configuration.**

---

**Priority**: HIGH - This affects all Florence ContentDM manuscripts
**Complexity**: LOW - Simple header adjustments (network already optimized)
**Impact**: HIGH - Will restore Florence library functionality
