# Florence Loader Implementation Analysis

## Current Implementation Status

### Dual Implementation Architecture
Florence has **TWO separate implementations** - a potential routing collision risk:

1. **Primary Implementation**: `FlorenceLoader.ts` - Individual dedicated loader
2. **Secondary Implementation**: `SharedManifestLoaders.ts` - `getFlorenceManifest()` method

### Routing Analysis

**Detection**: 
- Location: `EnhancedManuscriptDownloaderService.ts` line 1067
- Pattern: `url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')`
- Returns: `'florence'`

**Routing**:
- Location: `EnhancedManuscriptDownloaderService.ts` lines 2220-2222
- Route: `case 'florence':` → `this.loadLibraryManifest('florence', originalUrl)`
- Target: FlorenceLoader (registered at line 307)

**Registration**:
- Location: `EnhancedManuscriptDownloaderService.ts` line 307
- Key: `'florence'` 
- Loader: `new FlorenceLoader(loaderDeps)`

✅ **Routing Status**: PROPERLY ALIGNED - Detection → Routing → Registration all use `'florence'`

## Size Parameter Implementation

### Primary Implementation (FlorenceLoader.ts)

**Location**: Lines 238-240
```typescript
const pageLinks = pages.map(page => {
    // Try maximum resolution - Florence supports up to 6000px width
    return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`;
});
```

**Key Issues Identified**:
1. **HARDCODED 6000px**: No fallback mechanism if 6000px fails
2. **NO ERROR HANDLING**: No retry with smaller sizes
3. **NO SIZE VALIDATION**: No check if requested size is available
4. **SINGLE SIZE ONLY**: Only attempts maximum resolution

### Secondary Implementation (SharedManifestLoaders.ts)

**Location**: Lines 2861-2863
```typescript
const images: ManuscriptImage[] = pages.map((page, index) => ({
    url: `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`,
    label: page.title || `Page ${index + 1}`
}));
```

**Same Issues**:
- Also hardcoded to 6000px
- No fallback mechanism
- Identical size handling problems

## IIIF URL Structure Analysis

**Current URL Format**:
```
https://cdm21059.contentdm.oclc.org/iiif/2/{collection}:{pageId}/full/6000,/0/default.jpg
```

**IIIF Standard Parameters**:
- `{collection}:{pageId}` - Resource identifier  
- `full` - Region (full image)
- `6000,` - Size (6000px width, height auto-calculated) 
- `0` - Rotation
- `default.jpg` - Format and quality

**Alternative Size Options Available**:
- `full/max/` - Maximum available resolution
- `full/4000,/` - 4000px width
- `full/2000,/` - 2000px width  
- `full/1000,/` - 1000px width
- `full/800,/` - 800px width

## Error Handling Analysis

### Network Configuration
- **Connection Pooling**: Enabled with specialized settings (lines 1752-1764)
- **Timeout**: 60 seconds for Florence (line 1761)
- **Max Sockets**: Reduced to 3 concurrent connections (line 1758)  
- **Error Recovery**: ECONNRESET and ETIMEDOUT specific handling (lines 2362-2370)

### Current Error Handling Gaps
1. **No Size-Specific Errors**: Can't distinguish between "image not found" vs "size too large"
2. **No Automatic Fallback**: If 6000px fails, download fails completely
3. **No Size Discovery**: No attempt to discover maximum available size
4. **No Graceful Degradation**: Users get nothing instead of lower resolution

## Auto-Split Configuration

**Location**: `EnhancedDownloadQueue.ts`
- **Included in Auto-Split**: Line 1369 includes `'florence'`
- **Page Size Estimate**: 0.7 MB per page (line 1416)
- **Effect**: Large manuscripts automatically split into chunks to prevent download failures

## Performance Characteristics

**From Analysis**:
- **File Size Category**: Line 1160 estimates 200KB average (possibly outdated)
- **Timeout Classification**: Extended timeout library (120 seconds) - line 548
- **Network Reliability**: Requires specialized connection handling due to OCLC ContentDM infrastructure

## Proposed Size Fallback Logic

**Missing Implementation** (what should be added):

```typescript
async function getFlorenceImageWithFallback(baseUrl: string): Promise<string> {
    const sizes = ['max', '6000,', '4000,', '2000,', '1000,', '800,'];
    
    for (const size of sizes) {
        try {
            const testUrl = baseUrl.replace('/6000,/', `/${size}/`);
            const response = await this.fetchWithHTTPS(testUrl, { method: 'HEAD' });
            if (response.ok) {
                return testUrl;
            }
        } catch (error) {
            console.warn(`Florence size ${size} failed, trying next...`);
        }
    }
    
    throw new Error('No working image size found for Florence manuscript');
}
```

## Critical Code Locations

1. **Size Setting**: 
   - Primary: `/src/main/services/library-loaders/FlorenceLoader.ts:239`
   - Secondary: `/src/shared/SharedManifestLoaders.ts:2861`

2. **URL Construction**:
   - Template: `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/{SIZE}/0/default.jpg`

3. **Error Handling**:
   - Network: `/src/main/services/EnhancedManuscriptDownloaderService.ts:1652-1661` (DNS)
   - Timeout: `/src/main/services/EnhancedManuscriptDownloaderService.ts:2367-2370`

4. **Routing Logic**:
   - Detection: `/src/main/services/EnhancedManuscriptDownloaderService.ts:1067`
   - Routing: `/src/main/services/EnhancedManuscriptDownloaderService.ts:2220-2222`
   - Registration: `/src/main/services/EnhancedManuscriptDownloaderService.ts:307`

## Recommendations

1. **IMMEDIATE**: Replace hardcoded `6000,` with fallback logic starting from `max`
2. **VALIDATION**: Add size availability checking before attempting download
3. **ERROR HANDLING**: Implement size-specific retry mechanism  
4. **LOGGING**: Add size-specific logging to track which resolutions work
5. **USER FEEDBACK**: Inform users when using fallback resolution instead of maximum

## Code Quality Notes

Both implementations are essentially identical, suggesting the SharedManifestLoaders version might be redundant. The FlorenceLoader is the primary implementation being used based on routing analysis.

The size parameter issue is the core problem affecting user downloads, with the 6000px hardcoding being the specific line of code causing failures when manuscripts don't support that resolution.