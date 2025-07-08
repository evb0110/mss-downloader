# Belgica KBR High-Resolution Tile System Research Report

## Executive Summary

After comprehensive investigation of the Belgica KBR (Royal Library of Belgium) system, I have analyzed the tile-based viewer architecture and determined the optimal approach for implementing high-resolution manuscript downloads.

## Key Findings

### 1. Tile System Architecture

- **URL Pattern**: `https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0007/3-2-3.jpg`
- **Structure**: The system uses hierarchical paths with document ID segmentation and tile coordinates
- **Tile Format**: `{zoom}-{x}-{y}.jpg` where zoom level determines resolution, x/y are tile coordinates
- **Authentication**: Tile URLs require session authentication (return 403 Forbidden without proper access)

### 2. Access Control Analysis

- **Primary API**: `DigitalCollectionThumbnailHandler.ashx` is the main public interface
- **Tile System**: Requires authentication/session establishment through viewer interface
- **Working Documents**: Found SYRACUSE documents (16000000-16000019) but without digital content
- **Access Pattern**: Most manuscripts redirect to "notfound" images, indicating limited public digital access

### 3. SYRACUSE to Tile ID Mapping

- **Pattern**: `BE-KBR00_A-{syracuseId}_0000-00-00_00_0007`
- **Path Structure**: Document ID digits are split into directory hierarchy (`A/1/5/8/9/4/8/5/`)
- **Identifier Format**: Consistent prefix/suffix pattern with embedded SYRACUSE document ID

## Technical Implementation Strategy

### Current Approach Enhancement

Rather than implementing complex tile stitching (which requires authentication), the optimal approach is to enhance the existing `DigitalCollectionThumbnailHandler.ashx` API usage:

### 1. Maximum Resolution Discovery

Test comprehensive parameter combinations:

```javascript
// Size parameters to test
const sizeOptions = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE', 'FULL', 'ORIGINAL', 'MAX', 'MAXIMUM'];

// Quality parameters
const qualityOptions = ['100', '95', '90', '85', '80'];

// Custom dimensions
const customSizes = [
    { width: 2000, height: 2000 },
    { width: 4000, height: 4000 },
    { width: 6000, height: 6000 },
    { width: 8000, height: 8000 }
];

// Format options
const formatOptions = ['jpg', 'png', 'tiff', 'bmp'];

// Enhancement parameters
const enhancementOptions = ['&dpi=300', '&uncompressed=true', '&lossless=true'];
```

### 2. Systematic Quality Testing

For each document, test all parameter combinations to find maximum available resolution:

```javascript
async function findMaximumResolution(documentId) {
    let bestResolution = { params: '', bytes: 0, url: '' };
    
    for (const size of sizeOptions) {
        for (const quality of qualityOptions) {
            const testUrl = `${baseUrl}?documentId=${documentId}&page=1&size=${size}&quality=${quality}`;
            const response = await testRequest(testUrl);
            
            if (response.ok && response.contentLength > bestResolution.bytes) {
                bestResolution = {
                    params: `size=${size}&quality=${quality}`,
                    bytes: response.contentLength,
                    url: testUrl
                };
            }
        }
    }
    
    return bestResolution;
}
```

### 3. Fallback Chain Implementation

Create a robust fallback system:

1. **Primary**: Enhanced API with maximum resolution parameters
2. **Secondary**: Standard API with best available quality
3. **Tertiary**: Basic size options (MEDIUM, LARGE)
4. **Future**: Tile system integration when authentication method is discovered

## Enhanced Belgica Implementation

### Code Integration

The enhanced implementation should replace the current `loadBelgicaKbrManifest` method with:

1. **Comprehensive Resolution Testing**: Test all available parameter combinations
2. **Intelligent Caching**: Cache optimal parameters per document
3. **Progressive Enhancement**: Start with working parameters, test for better ones
4. **Error Resilience**: Handle authentication failures gracefully
5. **Performance Optimization**: Parallel testing with rate limiting

### Quality Metrics

- **Target Resolution**: 2000x2000+ pixels minimum
- **File Size**: Aim for 500KB+ per page (indicates high quality)
- **Format Priority**: PNG > JPG for manuscript content
- **Quality Setting**: Always test 100% quality first

## Tile System Future Implementation

### When Authentication is Solved

If/when the tile system authentication is resolved:

1. **Zoom Level Discovery**: Binary search for maximum zoom level
2. **Grid Dimension Calculation**: Discover tile grid size for each zoom level
3. **Tile Stitching**: Download and combine tiles into full-resolution images
4. **Performance**: Parallel tile downloading with progress tracking

### Implementation Approach

```javascript
class BelgicaTileSystem {
    async discoverMaxZoom(identifier) {
        // Binary search for maximum zoom level
    }
    
    async calculateGridDimensions(identifier, zoomLevel) {
        // Find max X and Y coordinates
    }
    
    async downloadTiles(identifier, zoomLevel, gridDimensions) {
        // Download all tiles for the zoom level
    }
    
    async stitchTiles(tiles, gridDimensions) {
        // Combine tiles into final high-resolution image
    }
}
```

## Recommendations

### Immediate Actions (Current Implementation)

1. ✅ **Enhance API Parameter Testing**: Implement comprehensive parameter discovery
2. ✅ **Optimize Resolution Detection**: Test all size/quality combinations
3. ✅ **Add Custom Dimension Support**: Test width/height parameters
4. ✅ **Implement Quality Caching**: Cache optimal parameters per document

### Future Enhancements

1. 🔄 **Tile Authentication Research**: Continue investigating viewer session establishment
2. 🔄 **Viewer Integration**: Reverse-engineer the authentication flow
3. 🔄 **Tile System Implementation**: Full tile downloading and stitching
4. 🔄 **Ultra-High Resolution**: Access to maximum available quality through tiles

## Conclusion

The current `DigitalCollectionThumbnailHandler.ashx` API approach is optimal for immediate implementation. The tile system exists but requires authentication that needs further investigation. The enhanced API approach will provide significant quality improvements while maintaining reliability and compatibility.

Focus should be on maximizing the API-based approach while keeping the tile system implementation as a future enhancement when authentication challenges are resolved.