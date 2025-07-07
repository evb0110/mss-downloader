# Rotomagus Implementation Recommendations

## Implementation Summary

**Status:** ✅ **READY FOR IMPLEMENTATION**

Rotomagus uses Gallica's IIIF infrastructure. Instead of implementing a separate Rotomagus service, we can leverage the existing Gallica library support with ARK identifier detection.

## Key Implementation Points

### 1. URL Pattern Detection
```javascript
// Detect Rotomagus URLs
const rotomagusPattern = /https?:\/\/(?:www\.)?rotomagus\.fr\/ark:\/([\d]+)\/([\w\d]+)\/f(\d+)/;

// Extract ARK identifier  
const arkMatch = url.match(rotomagusPattern);
if (arkMatch) {
    const arkId = arkMatch[2]; // e.g., "btv1b10052442z"
    // Transform to Gallica URL
    const gallicaUrl = `https://gallica.bnf.fr/iiif/ark:/12148/${arkId}/f{page}/full/8000,/0/native.jpg`;
}
```

### 2. Maximum Resolution Parameters
- **Use:** `full/8000,/0/native.jpg` for maximum quality
- **Expected size:** 6-10 MB per page
- **Resolution:** ~2500×4000 pixels average

### 3. Rate Limiting Strategy
- **Delay:** 2-3 seconds between requests
- **Handle 429 errors:** Implement exponential backoff
- **Timeout:** 30 seconds per request

### 4. Integration with Existing Gallica Support
Since Rotomagus uses Gallica's backend, we can:
1. **Extend existing Gallica library** to detect Rotomagus URLs
2. **Use same download logic** with ARK transformation
3. **Leverage existing rate limiting** and error handling

## Recommended Code Changes

### Option A: Extend Gallica Library (Recommended)
```javascript
// In existing Gallica library service
class GallicaLibraryService {
    detectLibraryFromUrl(url) {
        // Existing Gallica detection
        if (url.includes('gallica.bnf.fr')) {
            return 'gallica';
        }
        
        // Add Rotomagus detection
        if (url.includes('rotomagus.fr')) {
            return 'rotomagus-gallica';
        }
        
        return null;
    }
    
    transformRotomagusUrl(url) {
        const rotomagusPattern = /https?:\/\/(?:www\.)?rotomagus\.fr\/ark:\/([\d]+)\/([\w\d]+)\/f(\d+)/;
        const match = url.match(rotomagusPattern);
        
        if (match) {
            const arkId = match[2];
            const pageNum = match[3];
            return `https://gallica.bnf.fr/iiif/ark:/12148/${arkId}/f${pageNum}/full/8000,/0/native.jpg`;
        }
        
        return url;
    }
}
```

### Option B: Separate Rotomagus Service (Alternative)
```javascript
// Create new RotomagusLibraryService that extends GallicaLibraryService
class RotomagusLibraryService extends GallicaLibraryService {
    constructor() {
        super();
        this.libraryName = 'Rotomagus';
        this.baseUrl = 'https://gallica.bnf.fr/iiif/ark:/12148/';
    }
    
    extractArkId(url) {
        const pattern = /rotomagus\.fr\/ark:\/([\d]+)\/([\w\d]+)/;
        const match = url.match(pattern);
        return match ? match[2] : null;
    }
    
    buildImageUrl(arkId, pageNumber) {
        return `${this.baseUrl}${arkId}/f${pageNumber}/full/8000,/0/native.jpg`;
    }
}
```

## Testing Requirements

### Validation Test Cases
1. **URL Detection:** Test Rotomagus URL pattern matching
2. **ARK Extraction:** Verify correct ARK identifier extraction
3. **Gallica URL Generation:** Confirm proper URL transformation
4. **Maximum Resolution:** Test 8000px width parameter
5. **Rate Limiting:** Test with delays and error handling
6. **Multi-page Download:** Test sequential page discovery

### Sample URLs for Testing
```
https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom
https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f2.item.zoom
https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f3.item.zoom
```

## Performance Expectations

### File Sizes (8000px width)
- **Average:** 7-9 MB per page
- **Range:** 6-10 MB depending on manuscript content
- **Format:** High-quality JPEG

### Download Times
- **Per page:** 10-15 seconds (depends on connection)
- **Rate limiting:** +2-3 seconds delay between requests
- **Total manuscript:** Variable based on page count

## Error Handling

### Common Errors
1. **429 Too Many Requests:** Implement exponential backoff
2. **404 Not Found:** Page doesn't exist (end of manuscript)
3. **500 Server Error:** Temporary server issues
4. **Timeout:** Network connectivity issues

### Recommended Error Handling
```javascript
async function downloadWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await downloadImage(url);
            if (result.success) return result;
            
            // Handle rate limiting
            if (result.statusCode === 429) {
                const delay = Math.pow(2, i) * 2000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Handle other errors
            if (result.statusCode === 404) {
                throw new Error('Page not found');
            }
            
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
```

## UI/UX Considerations

### User Experience
1. **Library Name:** Display as "Rotomagus (via Gallica)"
2. **Progress Indication:** Show page-by-page download progress
3. **Rate Limiting Notice:** Inform user about slower download speeds
4. **Quality Setting:** Automatically use maximum resolution

### Status Messages
- "Detecting Rotomagus manuscript..."
- "Downloading via Gallica IIIF API..."
- "Using maximum resolution (8000px)..."
- "Rate limiting active (2-3 sec delays)..."

## Maintenance Notes

### Long-term Stability
- **ARK identifiers:** Permanent, will not change
- **Gallica API:** Stable, maintained by BnF
- **Rate limiting:** May change, monitor 429 errors
- **URL patterns:** Rotomagus may update their viewer URLs

### Monitoring
- **Success rate:** Should be >95% for valid manuscripts
- **Error patterns:** Monitor 429 vs 404 vs 500 errors
- **Performance:** Track download times and file sizes

## Conclusion

Rotomagus implementation is straightforward by leveraging existing Gallica infrastructure. The system provides excellent quality manuscripts with reliable access patterns. Implementation can be completed with minimal code changes by extending the existing Gallica library support.

**Priority:** High - Easy implementation with high user value
**Complexity:** Low - Reuses existing Gallica infrastructure  
**Quality:** Excellent - Maximum resolution IIIF images
**Stability:** High - BnF national library infrastructure