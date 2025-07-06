# MDC Catalonia CONTENTdm Image Extraction Analysis

**Date**: 2025-07-05  
**Analysis**: CONTENTdm-based systems for image extraction patterns  
**Target**: MDC Catalonia (Memòria Digital de Catalunya) - https://mdc.csuc.cat/

## Executive Summary

MDC Catalonia uses a CONTENTdm system with **IIIF v2 Cantaloupe server implementation**. The current codebase implementation is **already optimal** and uses the correct IIIF API patterns. No browser automation is required for image extraction.

## Current Implementation Analysis

### ✅ Current Implementation Status
The current implementation in `EnhancedManuscriptDownloaderService.ts` is **working correctly** and follows best practices:

```typescript
// Current working implementation uses IIIF v2 Cantaloupe format
const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageItemId}/full/max/0/default.jpg`;
```

**Key findings:**
- Uses correct IIIF v2 Cantaloupe format: `collection:id` 
- Properly extracts collection and item ID from URLs
- Implements sequential page discovery (compound objects)
- Fallback to single page if no compound structure found
- Maximum resolution extraction with `/full/max/0/default.jpg`

## CONTENTdm Standard Patterns Analysis

### IIIF API Patterns (RECOMMENDED)

**✅ Working Patterns:**
1. **IIIF Info Endpoint**: `https://mdc.csuc.cat/iiif/2/{collection}:{id}/info.json`
2. **IIIF Maximum Resolution**: `https://mdc.csuc.cat/iiif/2/{collection}:{id}/full/max/0/default.jpg`
3. **IIIF Full Resolution**: `https://mdc.csuc.cat/iiif/2/{collection}:{id}/full/full/0/default.jpg`
4. **IIIF Thumbnail**: `https://mdc.csuc.cat/iiif/2/{collection}:{id}/full/150,/0/default.jpg`

### CONTENTdm Utils Patterns

**❌ Failed Patterns:**
- `/utils/getthumbnail/collection/{collection}/id/{id}` → Returns "Invalid pointer"
- `/utils/getfile/collection/{collection}/id/{id}` → 404 Not Found
- `/utils/getstream/collection/{collection}/id/{id}` → 403 Forbidden

**Reason**: MDC Catalonia appears to use IIIF exclusively and has disabled or restricted traditional CONTENTdm utils endpoints.

### Alternative Access Patterns

**🔄 Redirect Patterns (Return HTML instead of images):**
- `/digital/collection/{collection}/id/{id}/file` → React application
- `/cdm/ref/collection/{collection}/id/{id}` → React application  
- `/digital/iiif/{collection}/{id}/thumbnail` → React application

These patterns return the main React-based CONTENTdm viewer instead of direct image access.

## Image Server Architecture

### IIIF v2 Cantaloupe Server
MDC Catalonia uses a **Cantaloupe IIIF image server** with the following characteristics:

- **Format**: IIIF Image API v2.1
- **Server**: Cantaloupe image server
- **URL Pattern**: `{base}/iiif/2/{collection}:{identifier}/{region}/{size}/{rotation}/{quality}.{format}`
- **Maximum Resolution**: Available via `/full/max/0/default.jpg`
- **Supported Formats**: JPG (default), PNG, WEBP, TIF

### Working IIIF URL Example
From actual manuscript page analysis:
```
https://mdc.csuc.cat/iiif/2/manuscritBC:1107/full/730,/0/default.jpg
```

## Metadata APIs Investigation

### ❌ Non-functional Metadata Endpoints
Tested the following standard CONTENTdm API endpoints:
- `/digital/api/collections/{collection}/items/{id}/info` → Returns HTML (React app)
- `/digital/api/collections/{collection}/items/{id}` → Returns HTML (React app)
- `/digital/api/collections/{collection}` → 404 Not Found
- `/digital/iiif/{collection}/{id}/manifest` → Returns HTML (React app)
- `/digital/iiif/2/{collection}:{id}/manifest` → 404 Not Found

### JavaScript-Based Interface
MDC Catalonia uses a modern React-based interface that loads content dynamically via JavaScript. Direct API endpoints are not publicly exposed.

## Image Extraction Strategy

### Recommended Approach (Current Implementation)

The current implementation is **optimal** and should be maintained:

1. **URL Pattern Recognition**: Detect `mdc.csuc.cat/digital/collection` URLs
2. **Parameter Extraction**: Extract collection and item ID using regex
3. **IIIF Info Request**: Query `/iiif/2/{collection}:{id}/info.json` for image information
4. **Page Discovery**: Test sequential page IDs using format `{itemId}-{pageNumber:003}`
5. **Image URL Construction**: Build maximum resolution URLs with `/full/max/0/default.jpg`

### Maximum Resolution Testing
Current implementation correctly uses `full/max/0/default.jpg` for maximum available resolution. Alternative patterns tested:
- `/full/full/0/default.jpg` (works but same as max)
- `/full/2000,/0/default.jpg` (fixed width, may be smaller)
- `/full/4000,/0/default.jpg` (fixed width, may be smaller)

The `max` parameter ensures the largest available image is returned.

## Browser Automation Analysis

### ❌ Browser Automation NOT Required
**Conclusion**: Browser automation is **unnecessary** for MDC Catalonia because:

1. **Direct IIIF Access**: Images are available via standard IIIF URLs
2. **No JavaScript Dependencies**: Image URLs can be constructed programmatically
3. **No Authentication**: Public manuscripts are accessible without login
4. **No Rate Limiting**: Standard HTTP requests work reliably

### Advantages of Current Approach
- **Performance**: Direct HTTP requests are much faster than browser automation
- **Reliability**: No browser crashes, memory leaks, or timing issues
- **Resource Efficiency**: Lower CPU and memory usage
- **Scalability**: Can handle concurrent downloads efficiently

## Test Results Summary

### Pattern Testing Results
- **Total patterns tested**: 14
- **Working patterns**: 4 (IIIF-based)
- **Failed patterns**: 10 (Utils and direct access)

### Working Image Extraction Patterns
1. ✅ IIIF Maximum Resolution
2. ✅ IIIF Thumbnail  
3. ✅ IIIF Info Endpoint
4. ✅ IIIF Full Resolution

### Failed Patterns
1. ❌ CONTENTdm Utils GetThumbnail (Invalid pointer)
2. ❌ CONTENTdm Utils GetFile (404)
3. ❌ Direct image server access (403)
4. ❌ Traditional metadata APIs (Return HTML)

## Recommendations

### 1. Maintain Current Implementation ✅
The current MDC Catalonia implementation is **optimal** and should not be changed:
- Uses correct IIIF v2 Cantaloupe format
- Properly handles compound objects with sequential page discovery
- Extracts maximum resolution images
- No browser automation required

### 2. Apply Pattern to Other CONTENTdm Sites
For other CONTENTdm-based libraries, test in this order:

#### Priority 1: IIIF API (Recommended)
```javascript
// Test both Cantaloupe and non-Cantaloupe formats
const cantaloupe = `${base}/iiif/2/${collection}:${id}/info.json`;
const standard = `${base}/iiif/${collection}/${id}/info.json`;
```

#### Priority 2: CONTENTdm Utils API
```javascript
const thumbnail = `${base}/utils/getthumbnail/collection/${collection}/id/${id}`;
const file = `${base}/utils/getfile/collection/${collection}/id/${id}`;
```

#### Priority 3: Direct Server Patterns
```javascript
const direct = `${base}/digital/collection/${collection}/id/${id}/file`;
const bridge = `${base}/cdm/ref/collection/${collection}/id/${id}`;
```

### 3. CONTENTdm Detection Strategy
For new CONTENTdm sites, implement this detection flow:
1. Test IIIF info endpoint (both Cantaloupe and standard formats)
2. Parse IIIF response for image specifications
3. Fallback to Utils API if IIIF unavailable
4. Use browser automation only as last resort for heavily protected sites

## Technical Specifications

### IIIF URL Components
```
https://mdc.csuc.cat/iiif/2/{collection}:{identifier}/{region}/{size}/{rotation}/{quality}.{format}
```

**Parameters:**
- `{collection}`: Collection alias (e.g., "manuscritBC")
- `{identifier}`: Item ID with page suffix (e.g., "1107" or "1107-001")
- `{region}`: "full" for complete image
- `{size}`: "max" for maximum resolution
- `{rotation}`: "0" for no rotation
- `{quality}`: "default" for best quality
- `{format}`: "jpg" for JPEG format

### Page Discovery Pattern
```javascript
// Test sequential pages with zero-padded format
const pageItemId = `${itemId}-${pageNumber.toString().padStart(3, '0')}`;
// Example: 1107-001, 1107-002, 1107-003, etc.
```

## Conclusion

MDC Catalonia represents an **ideal CONTENTdm implementation** for automated image extraction:
- Modern IIIF API support
- No browser automation required
- Maximum resolution images available
- Reliable programmatic access
- Well-structured compound object support

The current codebase implementation is **production-ready** and demonstrates best practices for CONTENTdm/IIIF integration. This pattern should be used as a template for implementing other CONTENTdm-based manuscript libraries.

## Files Generated During Analysis

1. `contentdm-pattern-test-results.json` - Comprehensive URL pattern test results
2. `contentdm-metadata-test-results.json` - Metadata API test results  
3. `contentdm-html-analysis.json` - HTML response analysis
4. `working_manuscript_page.html` - Sample working manuscript page HTML
5. Various test HTML files for failed endpoints

All test scripts available in `.devkit/temp/` for future reference and adaptation to other CONTENTdm sites.