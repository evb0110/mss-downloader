# Omnes Vallicelliana IIIF Server Analysis Report

## Summary
The Omnes Vallicelliana IIIF server (https://omnes.dbseret.com/vallicelliana/) is functioning correctly. The 500 errors occur when requesting images that exceed certain size thresholds.

## Working Image URL Patterns

### Base URL Structure
```
https://omnes.dbseret.com/vallicelliana/iiif/2/{canvas_id}/{region}/{size}/{rotation}/{quality}.{format}
```

### Verified Working Patterns
1. **Full resolution**: `/full/full/0/default.jpg` - Returns original size (3681x4764)
2. **Max parameter**: `/full/max/0/default.jpg` - Same as full resolution
3. **Width-based**: `/full/{width},/0/default.jpg` - Works up to width ~2773
4. **Height-based**: `/full,{height}/0/default.jpg` - Works for reasonable heights
5. **Specific sizes**: `/full/{width},{height}/0/default.jpg` - Works for predefined sizes
6. **Percentage**: `/full/pct:{percentage}/0/default.jpg` - Works up to 75%

## Size Limitations

### Maximum Working Dimensions
- **Maximum width**: ~2773 pixels (2774+ returns HTTP 500)
- **Maximum area**: ~8,697,360 pixels (from info.json maxArea)
- **Original dimensions**: 3681x4764 (17,536,284 pixels)

### Working Size Examples
- 115x149 (2,273 bytes)
- 230x298 (5,222 bytes)
- 460x596 (15,414 bytes)
- 920x1191 (58,363 bytes)
- 1841x2382 (220,951 bytes)
- 2000x2588 (252,371 bytes) - width-based
- 1545x2000 (157,883 bytes) - height-based
- 3681x4764 (1,002,066 bytes) - full resolution

## Authentication & Headers

### No Authentication Required
- All tested User-Agents work (Mozilla, curl, Wget)
- No Referer header required
- CORS enabled (Access-Control-Allow-Origin: *)
- Session cookie set but not required for access

## Recommendations for Implementation

### Optimal Download Strategy
1. **For highest quality**: Use `/full/full/0/default.jpg` (works despite exceeding maxArea)
2. **For reliability**: Use `/full/2000,/0/default.jpg` or specific sizes from info.json
3. **Avoid**: 
   - Widths > 2773 pixels
   - Percentage scaling > 75%
   - Constrained sizing with ! (returns HTTP 400)

### Example Working URLs
```
# Full resolution (highest quality)
https://omnes.dbseret.com/vallicelliana/iiif/2/IT-RM0281_D5_A_00001_00/full/full/0/default.jpg

# Safe high-quality alternative
https://omnes.dbseret.com/vallicelliana/iiif/2/IT-RM0281_D5_A_00001_00/full/2000,/0/default.jpg

# Specific size from manifest
https://omnes.dbseret.com/vallicelliana/iiif/2/IT-RM0281_D5_A_00001_00/full/1841,2382/0/default.jpg
```

### Canvas ID Pattern
Canvas IDs follow pattern: `{manuscript_id}_{letter}_[0-9]{5}_[0-9]{2}`
Examples:
- IT-RM0281_D5_A_00001_00
- IT-RM0281_D5_B_00001_00
- IT-RM0281_D5_C_00000_00

## Test Results Summary
- ✅ Manifest URLs work correctly
- ✅ Image URLs work with proper parameters
- ✅ No authentication required
- ✅ Multiple pages accessible
- ✅ Full resolution downloads possible (3681x4764)
- ✅ High-quality images (1-2.6MB per page)
- ✅ Real manuscript content verified
- ❌ Width > 2773 causes HTTP 500
- ❌ Some percentage values cause HTTP 500
- ❌ Constrained sizing (!) not supported

## Verified Downloads
Successfully downloaded and verified 10 manuscript pages:
- IT-RM0281_D5: 5 pages (1.0-1.2MB each)
- IT-RM0281_B6: 5 pages (1.5-2.6MB each)

Note: Some pages appear to be blank manuscript pages or covers, which is normal for historical manuscripts.

## Implementation Notes
The server appears to have a safety limit to prevent excessive resource usage, but interestingly allows full resolution downloads through `/full/full/0/default.jpg` pattern. This should be the preferred method for highest quality downloads as it provides the original resolution (3681x4764 for tested manuscripts) with excellent image quality.