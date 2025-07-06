# University of Freiburg Library - Technical Implementation Specification

## Library Overview
- **Name**: University of Freiburg Digital Library
- **URL**: https://dl.ub.uni-freiburg.de
- **Platform**: Custom DigiLit viewer system
- **Authentication**: None required
- **Test Manuscript**: hs360a (Sacramentary from Cologne, circa 1070-1080)

## URL Structure Analysis

### Viewer URLs
```
Pattern: https://dl.ub.uni-freiburg.de/diglit/{manuscript}/{page}
Example: https://dl.ub.uni-freiburg.de/diglit/hs360a/0001
```

### Image URLs
```
Pattern: https://dl.ub.uni-freiburg.de/diglitData/image/{manuscript}/{resolution}/{pageId}.jpg
Example: https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/4/003v.jpg
```

### Metadata URLs
```
METS XML: https://dl.ub.uni-freiburg.de/diglit/{manuscript}/mets
Redirects to: https://dl.ub.uni-freiburg.de/diglitData/mets/{manuscript}.xml
Example: https://dl.ub.uni-freiburg.de/diglitData/mets/hs360a.xml
```

## Resolution Levels

| Level | File Size (avg) | Quality | Status |
|-------|----------------|---------|---------|
| 1     | 212KB         | Low     | ✅ Available |
| 2     | 318KB         | Medium  | ✅ Available |
| 3     | 482KB         | High    | ✅ Available |
| 4     | 730KB         | **Maximum** | ✅ Available |
| 5+    | N/A           | N/A     | ❌ Not available |

**Recommendation**: Use resolution level `4` for maximum image quality.

## Page Naming Patterns

### Working Patterns
- **Front Cover**: `00000Vorderdeckel`
- **Recto/Verso Pages**: `{pageNum}r`, `{pageNum}v`
  - Examples: `001r`, `001v`, `002r`, `002v`, `003r`, `003v`
- **Zero-padded**: 3-digit page numbers (e.g., `001`, not `1`)

### Non-Working Patterns
- Simple numbers: `0001`, `0002`, `0010`
- Non-zero-padded: `1r`, `2v`, `10r`
- Back matter variations tested but not found

## Page Discovery Methods

### 1. METS XML Parsing (Recommended)
```javascript
const metsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscript}/mets`;
// METS redirects to: https://dl.ub.uni-freiburg.de/diglitData/mets/${manuscript}.xml
// Parse XML to extract page identifiers and file references
```

### 2. Systematic Pattern Testing
```javascript
// Test common patterns for each page number
const patterns = [
  `${pageNum.toString().padStart(3, '0')}r`,
  `${pageNum.toString().padStart(3, '0')}v`
];
```

### 3. Viewer Navigation Analysis
- **Total Pages**: Available in viewer navigation (434 pages for hs360a)
- **Page Numbers**: 4-digit zero-padded format in viewer URLs (0001-0434)
- **Image IDs**: Different from viewer page numbers (use r/v notation)

## Implementation Strategy

### URL Construction
```javascript
function buildFreiburgImageUrl(manuscript, pageId, resolution = '4') {
    return `https://dl.ub.uni-freiburg.de/diglitData/image/${manuscript}/${resolution}/${pageId}.jpg`;
}

function buildFreiburgViewerUrl(manuscript, viewerPage) {
    return `https://dl.ub.uni-freiburg.de/diglit/${manuscript}/${viewerPage}`;
}
```

### Page Discovery Algorithm
```javascript
async function discoverFreiburgPages(manuscript) {
    // Method 1: Parse METS XML
    const metsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscript}/mets`;
    const metsData = await fetchAndParseMets(metsUrl);
    
    // Method 2: Pattern-based discovery
    const pages = [];
    let pageNum = 1;
    
    while (pageNum <= 500) { // Reasonable upper limit
        const patterns = [
            `${pageNum.toString().padStart(3, '0')}r`,
            `${pageNum.toString().padStart(3, '0')}v`
        ];
        
        for (const pattern of patterns) {
            const imageUrl = buildFreiburgImageUrl(manuscript, pattern, '1'); // Use low res for testing
            if (await checkImageExists(imageUrl)) {
                pages.push(pattern);
            }
        }
        pageNum++;
    }
    
    return pages;
}
```

### Quality Optimization
- **Always use resolution level `4`** for maximum quality
- **Average file size**: ~730KB per image at max resolution
- **Format**: JPEG with good compression
- **No additional authentication** or session handling required

## Alternative Endpoints

### Thumbnails
```
Pattern: https://dl.ub.uni-freiburg.de/diglitData/image/{manuscript}/thumb/{pageId}.jpg
Example: https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/thumb/003v.jpg
Status: ✅ Available
```

### Viewer Image API
```
Pattern: https://dl.ub.uni-freiburg.de/diglit/{manuscript}/{viewerPage}/image
Example: https://dl.ub.uni-freiburg.de/diglit/hs360a/0010/image
Status: ✅ Available (returns HTML with image)
```

## Error Handling

### Common Error Scenarios
1. **HTTP 404**: Page/resolution not available
2. **HTTP 302**: METS URL redirects (follow automatically)
3. **Invalid page IDs**: Non-existent page patterns
4. **Timeout**: Network issues (implement retry logic)

### Validation Strategy
```javascript
async function validateFreiburgImage(manuscript, pageId, resolution = '4') {
    const imageUrl = buildFreiburgImageUrl(manuscript, pageId, resolution);
    
    try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        return {
            valid: response.status === 200,
            size: parseInt(response.headers.get('content-length') || '0'),
            contentType: response.headers.get('content-type')
        };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}
```

## Implementation Notes

### Authentication
- **No authentication required** for image access
- **No session cookies** needed
- **No API keys** required

### Rate Limiting
- **No apparent rate limiting** observed
- **Recommend**: 1-2 second delays between requests for courtesy
- **Concurrent downloads**: Limited testing, suggest max 3 parallel

### Metadata Access
- **METS XML**: Comprehensive metadata available
- **Page count**: Extractable from viewer or METS
- **Manuscript info**: Available in viewer HTML and METS

### Browser Compatibility
- **Works with standard HTTP libraries**
- **No JavaScript execution required**
- **Standard User-Agent headers** recommended

## Test Results Summary

### Successful Tests
- ✅ Resolution levels 1-4 functional
- ✅ Page pattern `{3-digit}r/v` works reliably
- ✅ METS metadata accessible
- ✅ No authentication barriers
- ✅ Thumbnail endpoints available
- ✅ Large manuscript support (434+ pages)

### Implementation Priority
1. **High Priority**: Resolution level 4 image access
2. **Medium Priority**: METS parsing for page discovery
3. **Low Priority**: Thumbnail support for previews

This specification provides a complete foundation for implementing University of Freiburg Library support in the manuscript downloader application.