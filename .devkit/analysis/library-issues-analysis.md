# Library Issues Analysis

## 1. NBM Italy (Nuova Biblioteca Manoscritta) - Verona Library

### Issue Description
- **URL**: https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15
- **Problem**: Only detects 10 pages, then hangs without downloading
- **Symptoms**: No logs visible

### Current Implementation Analysis

#### SharedManifestLoaders.js (getVeronaManifest)
```javascript
async getVeronaManifest(url) {
    const match = url.match(/codice=(\d+)/);
    if (!match) throw new Error('Invalid Verona URL');
    
    const codice = match[1];
    
    // New mapping based on network traffic analysis
    const manuscriptMappings = {
        '15': { collection: 'VR0056', manuscriptId: 'LXXXIX+(84)' } // From network traffic analysis
        // Other codice mappings would need to be verified with network traffic
    };
    
    const mapping = manuscriptMappings[codice];
    if (!mapping) {
        throw new Error(`Unknown Verona manuscript code: ${codice}`);
    }
    
    const images = [];
    
    // Generate first 10 pages using the exact pattern from network traffic
    for (let i = 1; i <= 10; i++) {
        const pageNum = String(i).padStart(3, '0');
        // Use the exact working pattern from network traffic
        const imageUrl = `https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%252Fbibliotecadigitale%252Fnbm%252FVR0056%252FLXXXIX%2B%252884%2529%252FVR0056-Cod._LXXXIX_%252884%2529_c._${pageNum}r/full/full/0/native.jpg`;
        
        images.push({
            url: imageUrl,
            label: `Page ${pageNum}r`
        });
    }
    
    return { 
        images,
        displayName: `Verona ${mapping.collection} - ${mapping.manuscriptId}`
    };
}
```

### Root Causes Identified

1. **Hardcoded Page Limit**: The implementation only generates 10 pages regardless of the actual manuscript size
2. **No Dynamic Page Detection**: The code doesn't check how many pages actually exist in the manuscript
3. **Hardcoded Mapping**: Only supports codice=15, other manuscripts will fail
4. **No IIIF Manifest Loading**: The code doesn't fetch the actual IIIF manifest to get the complete page list
5. **Missing Logging**: No debug logs to track what's happening during the process

### Recommended Fixes

1. **Load IIIF Manifest**: Instead of hardcoding pages, fetch the actual manifest:
   ```javascript
   const manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json`;
   ```

2. **Parse All Pages**: Extract all canvases from the manifest instead of limiting to 10

3. **Add More Mappings**: Support more codice values or dynamically discover the manifest ID

4. **Add Logging**: Implement proper logging for debugging

---

## 2. Morgan Library

### Issue Description
- **URL**: https://www.themorgan.org/collection/lindau-gospels/thumbs
- **Problem**: Downloads 16 pages in low quality, splits into two blocks as if each page is 300MB
- **Symptoms**: Low quality images, incorrect size estimation causing unnecessary splitting

### Current Implementation Analysis

#### EnhancedManuscriptDownloaderService.ts (loadMorganManifest)
The implementation has a sophisticated priority system for finding the highest resolution images:

```typescript
const imagesByPriority: { [key: number]: string[] } = {
    0: [], // HIGHEST PRIORITY: .zif tiled images (ULTRA HIGH RESOLUTION 6000x4000+ pixels, 25MP+)
    1: [], // NEW: High-resolution download URLs (749KB avg, 16.6x improvement)
    2: [], // High priority: direct full-size images  
    3: [], // Medium priority: converted styled images (reliable multi-page)
    4: [], // Low priority: facsimile images
    5: []  // Lowest priority: other direct references
};
```

### Root Causes Identified

1. **Size Estimation Issue**: The library optimization service might not have proper size estimation for Morgan Library, causing it to think images are 300MB each

2. **Priority System Not Working**: Despite having multiple priority levels, it seems to be falling back to low-quality thumbnails

3. **Page Limit**: The code limits parsing to 50 pages for performance:
   ```typescript
   // Limit to first 50 pages for performance (can be adjusted)
   ```

4. **ZIF Files Not Accessible**: The highest priority ZIF files might not be accessible or the URL pattern is incorrect

5. **Individual Page Parsing**: The code tries to fetch individual pages to find high-res downloads, but this might be failing

### Recommended Fixes

1. **Fix Size Estimation**: Add Morgan Library to the size estimation bypass list in LibraryOptimizationService

2. **Debug Priority System**: Add logging to see which priority level is actually being used

3. **Verify ZIF URLs**: Check if the ZIF URL pattern is correct:
   ```typescript
   const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
   ```

4. **Fix Page Detection**: Ensure all pages are detected, not just 16

5. **Remove Artificial Limits**: Consider removing or increasing the 50-page limit for proper manuscripts

---

## Common Issues Across Both Libraries

1. **Missing Error Logging**: Both implementations lack proper error logging, making debugging difficult

2. **No Progress Callbacks**: The manifest loading doesn't report progress, causing the UI to appear frozen

3. **Hardcoded Limits**: Both have artificial limits (10 pages for Verona, issues with page detection for Morgan)

4. **Size Estimation**: Both libraries seem to have issues with proper size estimation, causing download problems

5. **SSL/Network Issues**: Verona uses fetchWithHTTPS for SSL issues, but might still have connection problems

## Immediate Action Items

1. **Verona (NBM)**:
   - Implement proper IIIF manifest loading
   - Remove 10-page limit
   - Add support for more manuscript codes
   - Add comprehensive logging

2. **Morgan Library**:
   - Fix size estimation to prevent unnecessary splitting
   - Debug why high-resolution priorities aren't working
   - Ensure all pages are detected (not just 16)
   - Add logging to track which image quality is being selected

3. **Both Libraries**:
   - Add to LibraryOptimizationService with proper settings
   - Implement progress callbacks
   - Add error recovery mechanisms
   - Improve logging throughout the download process

## Detailed Code Issues Found

### Verona (NBM) Implementation Issues

1. **SharedManifestLoaders.js - hardcoded 10-page limit**:
   ```javascript
   // Generate first 10 pages using the exact pattern from network traffic
   for (let i = 1; i <= 10; i++) {
   ```
   This is why it only detects 10 pages.

2. **No actual IIIF manifest loading**: The implementation doesn't fetch the manifest JSON file, just generates URLs based on a pattern.

3. **Limited manuscript support**: Only codice=15 is supported, other manuscripts fail.

4. **EnhancedManuscriptDownloaderService.ts - proper manifest loading exists but may have issues**:
   - The loadVeronaManifest method does try to load the actual IIIF manifest
   - But SharedManifestLoaders is used by validation scripts and may be causing issues

### Morgan Library Implementation Issues

1. **Size estimation causing splitting**:
   ```javascript
   manifest.library === 'morgan' ? 25.0 : // Morgan .zif files are very large (average 25MB per stitched image)
   ```
   This assumes 25MB per page, which for 16 pages = 400MB, triggering the 300MB split threshold.

2. **Priority system seems correct but may have issues**:
   - Priority 0: ZIF files (highest quality)
   - Priority 1: High-res facsimile downloads
   - Priority 2-5: Various fallbacks
   - The code correctly iterates through priorities

3. **Page detection issue**: Only finding 16 pages suggests the page extraction regex or parsing is failing.

4. **ZIF files may not be working**: The ZIF processor service exists but may not be handling .zif files correctly.

### Specific Fixes Needed

1. **Verona SharedManifestLoaders.js**:
   - Fetch actual IIIF manifest from `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json`
   - Parse all canvases instead of hardcoding 10 pages
   - Add more manuscript mappings or discover them dynamically

2. **Morgan Library**:
   - Reduce size estimation from 25MB to a more reasonable value (e.g., 5MB)
   - Add logging to track which priority level provides the final images
   - Debug why only 16 pages are detected
   - Verify ZIF processor is working correctly

3. **LibraryOptimizationService.ts**:
   - Morgan has no settings (empty object), should add:
     ```typescript
     'morgan': {
         maxConcurrentDownloads: 3,
         timeoutMultiplier: 1.5,
         enableProgressiveBackoff: true,
         optimizationDescription: 'Morgan Library optimizations: 3 concurrent downloads, ZIF tiled image support'
     },
     ```
   - Verona already has settings but might need adjustment