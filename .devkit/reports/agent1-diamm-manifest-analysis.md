# DIAMM IIIF Manifest Analysis Report

## Executive Summary

All four DIAMM manifests have been successfully analyzed. The manifests follow IIIF Presentation API 2.0 standard with modern Image API 3.0 services. All manifests are accessible and contain valid manuscript data with varying canvas counts.

## Manifest Analysis Results

### 1. I-Rc-Ms-1907 (https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json)
- **IIIF Version**: Presentation API 2.0 / Image API 3.0
- **Canvas Count**: 525 pages
- **Label**: "I-Rc-Ms-1907"
- **Viewing Direction**: left-to-right
- **Viewing Hint**: paged
- **First Canvas Dimensions**: 6364x8742 pixels
- **Maximum Image Resolution**: 5000x5000 pixels (service constraint)
- **Available Sizes**: 6 predefined sizes from 99x136 to 3182x4371
- **Service Profile**: level2
- **Status**: ✅ Accessible

### 2. I-Ra-Ms1383 (https://iiif.diamm.net/manifests/I-Ra-Ms1383/manifest.json)
- **IIIF Version**: Presentation API 2.0 / Image API 3.0
- **Canvas Count**: 17 pages
- **Label**: "I-Ra-Ms1383"
- **Viewing Direction**: left-to-right
- **Viewing Hint**: paged
- **First Canvas Dimensions**: 8742x11656 pixels
- **Maximum Image Resolution**: 5000x5000 pixels (service constraint)
- **Available Sizes**: 6 predefined sizes from 136x182 to 4371x5828
- **Service Profile**: level2
- **Status**: ✅ Accessible

### 3. I-Rc-Ms-1574 (https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json)
- **IIIF Version**: Presentation API 2.0 / Image API 3.0
- **Canvas Count**: 78 pages
- **Label**: "I-Rc-Ms-1574"
- **Viewing Direction**: left-to-right
- **Viewing Hint**: paged
- **First Canvas Dimensions**: 11656x8742 pixels
- **Maximum Image Resolution**: 5000x5000 pixels (service constraint)
- **Available Sizes**: 6 predefined sizes
- **Service Profile**: level2
- **Status**: ✅ Accessible

### 4. I-Rv-C_32 (https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json)
- **IIIF Version**: Presentation API 2.0 / Image API 3.0
- **Canvas Count**: 75 pages
- **Label**: "I-Rv-C_32"
- **Viewing Direction**: left-to-right
- **Viewing Hint**: paged
- **First Canvas Dimensions**: 8695x3562 pixels
- **Maximum Image Resolution**: 5000x5000 pixels (service constraint)
- **Available Sizes**: 6 predefined sizes
- **Service Profile**: level2
- **Status**: ✅ Accessible

## Technical Analysis

### IIIF Compliance
- All manifests use IIIF Presentation API 2.0 context
- Image services implement IIIF Image API 3.0
- Full compliance with IIIF standards observed
- No authentication requirements detected

### Image Service Capabilities
- **Service Type**: ImageService3
- **Profile**: level2 (full feature support)
- **Max Dimensions**: 5000x5000 pixels (hard limit)
- **Formats**: JPEG (default), TIFF, WebP
- **Qualities**: color, gray, bitonal
- **Features**: regionByPct, sizeByPct, sizeByConfinedWh, sizeUpscaling, rotationBy90s, mirroring
- **Tiles**: 256x256 with scale factors 1,2,4,8,16,32,64

### Resolution Testing Results
- **Maximum Resolution**: Constrained to 5000x5000 pixels by service
- **Optimal Parameters**: 
  - `full/5000,/0/default.jpg` for maximum width
  - `full/,5000/0/default.jpg` for maximum height
  - `full/max/0/default.jpg` (may timeout on large images)
- **Connection Issues**: Some timeout issues observed with `/full/max/` parameter
- **Recommended**: Use specific pixel dimensions rather than "max"

### Performance Observations
- Image service responses can be slow for large images
- Timeouts observed with `/full/max/` requests
- Better performance with specific size parameters
- Info.json endpoints respond quickly and reliably

## Implementation Recommendations

### 1. URL Pattern
```
https://iiif.diamm.net/images/{manuscript-id}/{page-id}.tif/full/{size}/0/default.jpg
```

### 2. Optimal Size Parameters
- **For maximum quality**: `5000,` or `,5000` (depending on orientation)
- **For performance**: Use predefined sizes from info.json
- **Avoid**: `max` parameter due to timeout issues

### 3. Canvas Iteration Pattern
```javascript
// Example structure for canvas iteration
manifest.sequences[0].canvases.forEach(canvas => {
  const imageId = canvas.images[0].resource.service['@id'];
  const imageUrl = `${imageId}/full/5000,/0/default.jpg`;
});
```

### 4. Error Handling
- Implement timeout handling for image requests
- Fallback to smaller sizes if maximum resolution fails
- Check service info.json for available sizes

## Validation Status
- ✅ All 4 manifests accessible
- ✅ Valid JSON structure
- ✅ IIIF compliance verified
- ✅ Image services responding
- ✅ Canvas counts confirmed
- ✅ No authentication barriers
- ⚠️ Timeout issues with some large image requests

## Next Steps for Implementation
1. Implement DIAMM-specific URL pattern recognition
2. Add timeout handling for image downloads
3. Use 5000px constraint for maximum resolution
4. Test with actual image downloads to validate content
5. Implement progress tracking for large manuscripts

## Raw Data Location
- Manifest files saved to: `.devkit/reports/diamm-manifest-{id}.json`
- Canvas counts: 525, 17, 78, 75 respectively
- All manifests follow consistent structure patterns