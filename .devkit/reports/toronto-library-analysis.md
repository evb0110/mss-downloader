# University of Toronto Library Analysis Report

**Generated:** 2025-07-07T15:01:45.997Z

## Summary

The University of Toronto Libraries operates "Collections U of T", a digital repository providing open access to digitized collections from special collections and archives. The system supports IIIF (International Image Interoperability Framework) for interoperable access to manuscripts and rare books.

## Library Information

- **Name:** University of Toronto Libraries - Collections U of T
- **Base URL:** https://collections.library.utoronto.ca
- **IIIF Support:** Yes
- **Access Type:** Open access
- **Primary Collection:** Thomas Fisher Rare Book Library

## URL Pattern Analysis

### Collection View URLs
- **Pattern:** `https://collections.library.utoronto.ca/view/{PID}`
- **Example:** `https://collections.library.utoronto.ca/view/fisher2:F6521`

### IIIF Manifest URLs
- **Pattern:** `https://iiif.library.utoronto.ca/presentation/{PID}/manifest`
- **Example:** `https://iiif.library.utoronto.ca/presentation/fisher2:F6521/manifest`

### PID Structure
- Fisher Library manuscripts use the prefix `fisher2:`
- Full PID format: `{collection}:{identifier}`

## IIIF Implementation Details

### Supported APIs
- **Presentation API:** Versions 2.0, 3.0
- **Default Version:** 2.0
- **Image API:** Supported
- **Manifest Format:** JSON

### Image Access Parameters
- **Resolutions:** full, max, !1024,1024, !2048,2048, !4096,4096
- **Formats:** jpg, png, webp
- **Quality Levels:** default, color, gray, bitonal

## Implementation Requirements for Manuscript Downloader

### URL Detection
```javascript
// Regex pattern to match Toronto collection URLs
const torontoPattern = /collections\.library\.utoronto\.ca\/view\/(.+)/;

// Extract PID from URL
function extractPID(url) {
    const match = url.match(torontoPattern);
    return match ? match[1] : null;
}
```

### Manifest Construction
```javascript
// Build IIIF manifest URL from PID
function buildManifestUrl(pid) {
    return `https://iiif.library.utoronto.ca/presentation/${pid}/manifest`;
}
```

### Image Download Strategy
1. **Primary:** Use IIIF Image API with maximum resolution parameters
2. **Resolution Testing:** Try `full`, `max`, `!1024,1024`, `!2048,2048`, `!4096,4096`
3. **Fallback:** Use canvas image URLs from manifest if IIIF Image API fails

## Connectivity Assessment

⚠️ **Direct Access:** Issues detected - may require alternative approaches

### Observed Issues
- Connection timeouts
- Slow response times

### Possible Causes
- Geographic access restrictions
- Rate limiting for automated requests
- Server capacity limitations
- Network filtering

### Recommended Workarounds
- Use longer timeouts (30+ seconds)
- Implement retry logic with exponential backoff
- Add realistic user agent strings
- Respect rate limits with delays
- Use alternative access via Biblissima mirrors

## Alternative Access Methods

### Biblissima Portal
- **Available:** Yes
- **Base URL:** https://iiif.biblissima.fr/collections/
- **Toronto Manuscripts:** Available

## Testing Strategy

### Required Tests
- **Connectivity Test:** Verify access to iiif.library.utoronto.ca
- **Manifest Validation:** Ensure manifests parse as valid JSON
- **Image Access Test:** Verify image URLs resolve and download
- **Resolution Testing:** Test multiple resolution parameters for optimal quality
- **Page Count Validation:** Verify all manuscript pages are accessible
- **Pdf Generation Test:** Create multi-page PDFs from downloaded images

### Sample Manuscripts for Testing
- **F6521** (`fisher2:F6521`): [View](https://collections.library.utoronto.ca/view/fisher2:F6521) | [Manifest](https://iiif.library.utoronto.ca/presentation/fisher2:F6521/manifest)
- **F4089** (`fisher2:F4089`): [View](https://collections.library.utoronto.ca/view/fisher2:F4089) | [Manifest](https://iiif.library.utoronto.ca/presentation/fisher2:F4089/manifest)
- **165** (`fisher2:165`): [View](https://collections.library.utoronto.ca/view/fisher2:165) | [Manifest](https://iiif.library.utoronto.ca/presentation/fisher2:165/manifest)

## Implementation Priority

**Recommended Implementation:** alternative_access_with_fallback

### Primary Implementation Approach
Due to connectivity limitations with the direct University of Toronto IIIF API, the implementation should focus on:

1. **Multi-endpoint Strategy**: Try multiple IIIF endpoints in order of preference
2. **Robust Error Handling**: Implement comprehensive retry logic and fallbacks
3. **Alternative Access**: Use Biblissima portal when direct access fails

### Implementation Steps
1. Add URL pattern detection for `collections.library.utoronto.ca`
2. Implement PID extraction from URLs
3. Create multi-endpoint manifest fetching:
   - Primary: `https://iiif.library.utoronto.ca/presentation/{PID}/manifest`
   - Secondary: `https://iiif.library.utoronto.ca/presentation/v2/{PID}/manifest`
   - Fallback: Search Biblissima for Toronto Fisher manuscripts
4. Implement image resolution testing to find maximum quality
5. Add proper rate limiting and error handling with 30+ second timeouts
6. Test with sample manuscripts from Fisher Library

### Code Implementation Template

```typescript
class TorontoLibraryService {
    private static readonly ENDPOINTS = [
        'https://iiif.library.utoronto.ca/presentation/{PID}/manifest',
        'https://iiif.library.utoronto.ca/presentation/v2/{PID}/manifest',
        'https://iiif.library.utoronto.ca/presentation/v2/collections/fisher:root'
    ];

    async fetchManifest(pid: string): Promise<any> {
        for (const endpoint of TorontoLibraryService.ENDPOINTS) {
            try {
                const url = endpoint.replace('{PID}', pid);
                const manifest = await this.fetchWithRetry(url, {
                    timeout: 30000,
                    retries: 3,
                    delay: 2000
                });
                return manifest;
            } catch (error) {
                console.warn(`Failed to fetch from ${endpoint}:`, error.message);
                continue;
            }
        }
        throw new Error(`Unable to fetch manifest for PID: ${pid}`);
    }

    extractPID(url: string): string | null {
        const match = url.match(/collections\.library\.utoronto\.ca\/view\/(.+)/);
        return match ? match[1] : null;
    }

    async testImageResolutions(imageService: string): Promise<string[]> {
        const resolutions = ['full', 'max', '!4096,4096', '!2048,2048', '!1024,1024'];
        const workingResolutions = [];
        
        for (const resolution of resolutions) {
            try {
                const testUrl = `${imageService}/${resolution}/0/default.jpg`;
                await this.testImageUrl(testUrl);
                workingResolutions.push(resolution);
            } catch (error) {
                console.warn(`Resolution ${resolution} failed:`, error.message);
            }
        }
        
        return workingResolutions;
    }
}
```

## Special Considerations for Toronto Library

### Connectivity Challenges
- **High Timeout Requirements**: Use 30+ second timeouts for all requests
- **Geographic Restrictions**: The library may restrict access based on location
- **Rate Limiting**: Implement 2-3 second delays between requests
- **Server Capacity**: Limited concurrent connection support

### Alternative Collection Endpoints
Based on research, these additional endpoints may be available:
- Collection root: `https://iiif.library.utoronto.ca/presentation/v2/collections/fisher:root`
- Collection search: `https://fishercollections.library.utoronto.ca/`
- Biblissima aggregation: `https://iiif.biblissima.fr/collections/`

### Expected IIIF Manifest Structure
```json
{
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@id": "https://iiif.library.utoronto.ca/presentation/fisher2:F6521/manifest",
  "@type": "sc:Manifest",
  "label": "Manuscript Title",
  "sequences": [{
    "@type": "sc:Sequence",
    "canvases": [{
      "@id": "https://iiif.library.utoronto.ca/presentation/fisher2:F6521/canvas/1",
      "@type": "sc:Canvas",
      "images": [{
        "resource": {
          "service": {
            "@id": "https://iiif.library.utoronto.ca/image/v2/fisher2:F6521_001",
            "profile": "http://iiif.io/api/image/2/level1.json"
          }
        }
      }]
    }]
  }]
}
```

### Troubleshooting Guide

#### Common Issues and Solutions

1. **Connection Timeouts**
   - Increase timeout to 30+ seconds
   - Implement exponential backoff retry logic
   - Try alternative endpoint URLs

2. **403/404 Errors**
   - Verify PID format (should include collection prefix like `fisher2:`)
   - Try alternative IIIF API versions (v2 vs v3)
   - Check if manuscript is publicly accessible

3. **Slow Image Downloads**
   - Start with lower resolution parameters
   - Use progressive enhancement (try higher resolutions after confirming access)
   - Implement concurrent download limits (max 2-3 simultaneously)

#### Testing Checklist
- [ ] URL pattern recognition works for all three sample URLs
- [ ] PID extraction correctly handles `fisher2:` prefix
- [ ] Manifest fetching succeeds with retry logic
- [ ] Image URLs resolve and download successfully
- [ ] Maximum resolution detection works
- [ ] PDF generation produces valid multi-page documents
- [ ] Rate limiting prevents server overload

## Quality Expectations

- **Resolution:** High resolution (typically 2000+ pixels)
- **Format:** JPEG with high quality settings
- **Color Depth:** 24-bit color for color manuscripts
- **Compression:** Moderate JPEG compression

## Rate Limiting Recommendations

- **Delay Between Requests:** 1-2 seconds between requests
- **Concurrent Requests:** Limit to 2-3 concurrent

---

*This analysis is based on publicly available documentation and connectivity testing performed on 2025-07-07T15:01:45.997Z.*
