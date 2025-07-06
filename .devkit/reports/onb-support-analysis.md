# ONB (Austrian National Library) Support Analysis

## Executive Summary

**Status: ✅ FEASIBLE - Standard IIIF Implementation**

The Austrian National Library (ONB) uses a standard IIIF v3 implementation that is fully compatible with existing manuscript downloader architecture. No special authentication or complex workarounds are required.

## Technical Analysis

### API Discovery

- **Viewer URL Pattern**: `https://viewer.onb.ac.at/{manuscript_id}`
- **Manifest API**: `https://api.onb.ac.at/iiif/presentation/v3/manifest/{manuscript_id}`
- **Image API**: `https://api.onb.ac.at/iiif/image/v3/{manuscript_id}/{image_id}/{region}/{size}/{rotation}/{quality}.{format}`

### IIIF Compliance

- **Presentation API**: IIIF v3 (latest standard)
- **Image API**: IIIF v3 with level2 profile
- **Context**: `http://iiif.io/api/presentation/3/context.json`
- **Authentication**: None required

### Test Case Results

**Test Manuscript**: `1000B160` - "Missale" (10th century)
- **Total Pages**: 445 pages
- **Image Format**: JPEG
- **Maximum Resolution**: Available via `/full/max/0/default.jpg`
- **Alternative Resolutions**: Supports standard IIIF size parameters

### Image Service Capabilities

#### Resolution Testing
| Size Parameter | Status | Example Dimensions | File Size |
|---------------|--------|-------------------|-----------|
| `/full/max/0/default.jpg` | ✅ Working | 1098x1316 | ~146KB |
| `/full/full/0/default.jpg` | ✅ Working | Same as max | ~146KB |
| `/full/2000,/0/default.jpg` | ✅ Working | Width limited to 2000px | Variable |
| `/full/1000,/0/default.jpg` | ✅ Working | Width limited to 1000px | Variable |
| `/full/500,/0/default.jpg` | ✅ Working | Width limited to 500px | ~32KB |

#### Access Control Testing
- ✅ No authentication required
- ✅ No referrer restrictions
- ✅ Works with minimal headers
- ✅ Standard HTTP requests accepted

## Implementation Requirements

### URL Pattern Recognition
```javascript
// Viewer URL pattern
const viewerPattern = /https:\/\/viewer\.onb\.ac\.at\/([^\/]+)/;

// Extract manuscript ID from viewer URL
function extractManuscriptId(url) {
    const match = url.match(viewerPattern);
    return match ? match[1] : null;
}

// Generate manifest URL
function getManifestUrl(manuscriptId) {
    return `https://api.onb.ac.at/iiif/presentation/v3/manifest/${manuscriptId}`;
}
```

### Manifest Processing
- Standard IIIF v3 manifest structure
- Pages available in `manifest.items[]`
- Each canvas contains annotation with image service
- Image service ID: `annotation.body.service[0].id`

### Image Download
- Maximum resolution: `{serviceId}/full/max/0/default.jpg`
- No special headers required beyond standard browser headers
- Server uses chunked encoding (Content-Length may be 0)

## Integration Steps

### 1. URL Detection
Add ONB viewer URL pattern to existing URL recognition:
```javascript
if (url.includes('viewer.onb.ac.at')) {
    return 'onb';
}
```

### 2. Manifest Fetching
```javascript
async function fetchONBManifest(manuscriptId) {
    const manifestUrl = `https://api.onb.ac.at/iiif/presentation/v3/manifest/${manuscriptId}`;
    const response = await fetch(manifestUrl);
    return await response.json();
}
```

### 3. Image Processing
```javascript
function extractONBImages(manifest) {
    return manifest.items.map((canvas, index) => {
        const annotation = canvas.items[0].items[0];
        const service = annotation.body.service[0];
        return {
            url: `${service.id}/full/max/0/default.jpg`,
            filename: `page_${String(index + 1).padStart(3, '0')}.jpg`
        };
    });
}
```

## Validation Results

### Successful Tests
- ✅ Manifest retrieval and parsing
- ✅ Image service discovery
- ✅ Maximum resolution access
- ✅ Multiple page testing (445 pages)
- ✅ File format validation (JPEG)
- ✅ Download verification

### Sample Data
- **Manuscript**: 1000B160 - "Missale" (959-999 AD)
- **Pages**: 445 pages available
- **Quality**: High resolution scans
- **Content**: Medieval manuscript with illuminations

## Recommendation

**Implement ONB support immediately** - This is a straightforward IIIF implementation that requires minimal custom code. The library uses standard patterns already supported by the existing downloader architecture.

### Priority: HIGH
- Standard IIIF v3 compliance
- No authentication barriers
- Large collection of manuscripts
- High-quality digitization
- Reliable API performance

### Implementation Effort: LOW
- Reuse existing IIIF v3 code
- Add URL pattern recognition
- Minimal custom logic required
- Standard error handling applies

## Technical Notes

1. **Content-Length Header**: The server doesn't set Content-Length headers but uses chunked encoding. Downloads work correctly.

2. **Image IDs**: Each image has a unique ID (e.g., `uk4nGb4kQHe3msbC`) that's not predictable, requiring manifest parsing.

3. **Maximum Resolution**: Always use `/full/max/0/default.jpg` for highest quality.

4. **Error Handling**: Standard IIIF error responses (404 for non-existent manuscripts).

5. **Rate Limiting**: No apparent rate limiting observed in testing.

## Sample Implementation Code

```javascript
class ONBService extends IIIFService {
    static urlPattern = /https:\/\/viewer\.onb\.ac\.at\/([^\/]+)/;
    
    static extractId(url) {
        const match = url.match(this.urlPattern);
        return match ? match[1] : null;
    }
    
    static getManifestUrl(id) {
        return `https://api.onb.ac.at/iiif/presentation/v3/manifest/${id}`;
    }
    
    static getMaxResolutionUrl(serviceId) {
        return `${serviceId}/full/max/0/default.jpg`;
    }
}
```

This implementation can be integrated into the existing IIIF service architecture with minimal modifications.