# DIAMM URL Pattern Analysis Report

## Executive Summary
This report analyzes the DIAMM (Digital Image Archive of Medieval Music) URL patterns and provides integration recommendations for the manuscript downloader system. DIAMM manuscripts are accessed through the musmed.eu IIIF viewer, which requires extracting manifest URLs from encoded parameters.

## URL Structure Analysis

### Primary Pattern: musmed.eu IIIF Viewer
All provided DIAMM URLs follow this pattern:
```
https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2F{MANUSCRIPT_ID}%2Fmanifest.json
```

### URL Components Breakdown

#### 1. Base URL
- **Host**: `musmed.eu`
- **Path**: `/visualiseur-iiif`
- **Purpose**: IIIF viewer interface for DIAMM manuscripts

#### 2. Manifest Parameter
- **Parameter**: `manifest` (URL encoded)
- **Pattern**: `https://iiif.diamm.net/manifests/{MANUSCRIPT_ID}/manifest.json`
- **Encoding**: Standard URL encoding (`%3A` for `:`, `%2F` for `/`)

#### 3. Manuscript ID Patterns
Based on the provided URLs, manuscript IDs follow these patterns:
- `I-Rc-Ms-1907` (Italy - Rome, private collection, manuscript 1907)
- `I-Ra-Ms1383` (Italy - Rome, archive, manuscript 1383)
- `I-Rc-Ms-1574` (Italy - Rome, private collection, manuscript 1574)
- `I-Rv-C_32` (Italy - Rome, Vatican, codex 32)

### Example URL Breakdown
```
Original URL: https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json

Decoded:
- Base: https://musmed.eu/visualiseur-iiif
- Manifest: https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json
- Manuscript ID: I-Rc-Ms-1907
```

## IIIF Manifest Analysis

### Manifest Structure
DIAMM uses IIIF Presentation API v2.0 with the following characteristics:
- **Context**: `http://iiif.io/api/presentation/2/context.json`
- **Type**: `sc:Manifest`
- **Image Service**: IIIF Image API v2.0
- **Profile**: `http://iiif.io/api/image/2/level1.json`

### Image Service Endpoints
Each page image follows this pattern:
```
https://iiif.diamm.net/images/{MANUSCRIPT_ID}/{PAGE_LABEL}.tif
```

Examples:
- `https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif`
- `https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_69v.tif`

### Maximum Resolution Strategy
All images support standard IIIF size parameters:
- `full/full/0/default.jpg` - Full resolution
- `full/max/0/default.jpg` - Maximum available
- `full/2000,/0/default.jpg` - Width constrained to 2000px

## Integration Strategy

### 1. URL Pattern Matching
Add to the `detectLibrary` function:
```typescript
// Direct DIAMM manifest URLs
if (url.includes('iiif.diamm.net') && url.includes('manifest')) return 'diamm';

// musmed.eu viewer URLs with DIAMM manifests
if (url.includes('musmed.eu') && url.includes('manifest=')) {
    const manifestParam = new URL(url).searchParams.get('manifest');
    if (manifestParam && decodeURIComponent(manifestParam).includes('iiif.diamm.net')) {
        return 'diamm';
    }
}
```

### 2. Manifest URL Extraction
For musmed.eu viewer URLs, extract the actual manifest URL:
```typescript
function extractDiammManifestUrl(url: string): string {
    const urlObj = new URL(url);
    const manifestParam = urlObj.searchParams.get('manifest');
    if (manifestParam) {
        return decodeURIComponent(manifestParam);
    }
    return url; // Return original if already a manifest URL
}
```

### 3. Library Type Definition
Add to `TLibrary` union type:
```typescript
export type TLibrary = '...' | 'diamm';
```

### 4. Supported Libraries List
Add to `SUPPORTED_LIBRARIES` array:
```typescript
{
    name: 'DIAMM (Digital Image Archive of Medieval Music)',
    example: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Ra-Ms1383%2Fmanifest.json',
    description: 'Digital Image Archive of Medieval Music manuscripts via IIIF (accessed through musmed.eu viewer)',
}
```

## Implementation Recommendations

### 1. URL Validation
- Validate that musmed.eu URLs contain the `manifest` parameter
- Validate that the decoded manifest URL points to `iiif.diamm.net`
- Provide clear error messages for invalid URLs

### 2. Manifest Processing
- Extract manifest URL from viewer URLs before processing
- Handle both direct manifest URLs and viewer URLs
- Use standard IIIF manifest parsing logic

### 3. Image Resolution Testing
- Test multiple IIIF size parameters to find maximum resolution
- Recommended test sequence: `full/max`, `full/full`, `full/4000,`, `full/2000,`
- Compare actual image dimensions and file sizes

### 4. Error Handling
- Handle URL decoding errors gracefully
- Provide meaningful error messages for users
- Implement retry logic for network failures

### 5. User Experience
- Display manuscript ID in the UI (extracted from manifest URL)
- Show that the manuscript is accessed through DIAMM
- Provide link to original viewer for reference

## Technical Considerations

### 1. CORS and Access
- DIAMM IIIF endpoints appear to be publicly accessible
- Standard IIIF headers should be sufficient
- No special authentication required

### 2. Rate Limiting
- Implement standard IIIF rate limiting
- Consider DIAMM-specific timeout adjustments if needed
- Monitor for any access restrictions

### 3. Caching Strategy
- Cache manifest responses as with other IIIF libraries
- Consider caching decoded manifest URLs to avoid repeated processing

## Next Steps

1. **Implementation**: Add DIAMM detection logic to `detectLibrary` function
2. **Testing**: Validate URL extraction and manifest processing
3. **Resolution Testing**: Test maximum resolution parameters
4. **Integration**: Add to library type definitions and UI
5. **Documentation**: Update user-facing documentation

## Conclusion

DIAMM integration is straightforward due to its standard IIIF compliance. The main complexity lies in properly extracting manifest URLs from the musmed.eu viewer URLs. Once the manifest URL is extracted, standard IIIF processing can be applied.

The implementation should support both:
- Direct manifest URLs: `https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json`
- Viewer URLs: `https://musmed.eu/visualiseur-iiif?manifest=...`

This dual support ensures maximum compatibility with user workflows while maintaining clean URL handling internally.