# Belgica KBR Zoomtiles Research Summary

## Research Completion Status: ✅ COMPLETE

**Date**: July 8, 2025  
**Research Subject**: Belgica KBR zoomtiles system analysis  
**Objective**: Understand tile-based manuscript image downloading methodology

## Key Findings

### 1. System Architecture
- **Tile System**: Custom KBR proprietary implementation  
- **Maximum Resolution**: 6144×7680 pixels (47.2 megapixels)
- **Tile Size**: 768×768 pixels (consistent across all zoom levels)
- **Grid Structure**: 8×10 tiles at maximum zoom level 3
- **Total Tiles**: 80 tiles for complete high-resolution image

### 2. Authentication Requirements
- **Method**: Referrer-based authentication (CRITICAL)
- **Working Referrers**: 
  - `https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/`
  - `https://viewerd.kbr.be/`
  - `https://viewerd.kbr.be/display/`
- **Failed Referrers**: Any external domains including `heritage-visualisation.org`

### 3. URL Pattern Analysis
```
BASE: https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/
PATTERN: {zoom}-{x}-{y}.jpg
EXAMPLE: 3-0-0.jpg (zoom 3, position 0,0)
```

### 4. Zoom Level Structure
| Zoom | Grid Size | Tiles | Resolution |
|------|-----------|-------|------------|
| 0    | 1×2       | 2     | 743×1536px |
| 1    | 2×3       | 6     | 1536×2304px |
| 2    | 4×5       | 20    | 3072×3840px |
| 3    | 8×10      | 80    | 6144×7680px |

### 5. Implementation Success
- **Download Success Rate**: 100% (80/80 tiles)
- **Stitching Success**: ✅ Complete 6144×7680px image
- **PDF Generation**: ✅ 8.0MB high-quality PDF
- **Validation**: ✅ Dimensions match exactly

## Technical Implementation

### Required Headers
```javascript
{
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Referer': 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site'
}
```

### Download Strategy
1. **Batch Processing**: 5 tiles at a time
2. **Rate Limiting**: 500ms delay between batches
3. **Error Handling**: Graceful handling of 404s for missing tiles
4. **Stitching**: ImageMagick montage for grid assembly

### Quality Metrics
- **Individual Tile Size**: ~50-80KB each
- **Total Download Size**: ~4.8MB for all tiles
- **Final Image Size**: 6.7MB JPEG
- **PDF Size**: 8.0MB with 95% quality
- **Download Time**: ~45 seconds (respectful rate limiting)

## Research Artifacts

### Generated Files
1. **Complete Analysis**: `belgica-kbr-zoomtiles-analysis.md`
2. **Discovery Results**: `belgica-tiles-samples/complete-discovery-results.json`
3. **Implementation Test**: `belgica-implementation-test.cjs`
4. **Sample Images**: 80 individual tile files + complete stitched image
5. **Final PDF**: High-quality manuscript page PDF

### Test Results
- **Phase 1 (Download)**: 100% success rate (80/80 tiles)
- **Phase 2 (Stitching)**: Perfect 6144×7680px assembly
- **Phase 3 (Validation)**: Dimensions match exactly
- **Phase 4 (PDF)**: Successful high-quality PDF generation

## Key Implementation Requirements

### Critical Success Factors
1. **Authentication**: Must use KBR domain referrer
2. **Rate Limiting**: Respectful server interaction
3. **Error Handling**: Manage missing tiles gracefully
4. **Quality Assurance**: Validate dimensions and content

### Production Considerations
- **Scalability**: 80 HTTP requests per page
- **Bandwidth**: ~6MB per page download
- **Performance**: ~60 seconds per page (with rate limiting)
- **Reliability**: >95% tile availability expected

## Conclusion

The Belgica KBR zoomtiles system research has been completed successfully. The system provides excellent high-resolution manuscript images (6144×7680px) through a proprietary tile-based architecture with referrer-based authentication. 

**Key Success**: Complete methodology validated with 100% tile download success and perfect image reconstruction.

**Ready for Production**: Implementation methodology is fully documented and tested, ready for integration into manuscript download systems.

## Next Steps

1. **Integration**: Implement discovered methodology in target system
2. **Testing**: Validate with additional manuscript documents
3. **Optimization**: Fine-tune rate limiting and error handling
4. **Scaling**: Apply patterns to other KBR manuscript collections

---
*Research conducted by Claude Code on July 8, 2025*