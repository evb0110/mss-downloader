# Florence ContentDM API Maximum Resolution Fix

## Problem Identified

The Florence library loader was using ContentDM's native API with `default.jpg` parameter, which provides significantly lower resolution images compared to the available IIIF Image API.

### Original URL Format (LOW RESOLUTION)
```
https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/{collection}/{id}/default.jpg
```

### New URL Format (MAXIMUM RESOLUTION)  
```
https://cdm21059.contentdm.oclc.org/digital/iiif/{collection}/{id}/full/max/0/default.jpg
```

## Resolution Improvement Results

### Test Case: Manuscript Page ID 24932 from collection "plutei"

| API Type | File Size | Dimensions | Quality |
|----------|-----------|------------|---------|
| **Old Native API** | 94,510 bytes (92 KB) | 894×1,239 pixels | Low Resolution |
| **New IIIF API** | 1,160,148 bytes (1,133 KB) | 3,579×4,957 pixels | Maximum Resolution |
| **Improvement** | **12.3x larger files** | **4x width, 4x height** | **16x more pixels** |

### Consistency Test: Page ID 24933
- IIIF API: 1,251,313 bytes (1,222 KB) at 3,535×4,830 pixels
- Confirms consistent high-resolution delivery across pages

## Technical Implementation

### Files Modified
- `/src/main/services/library-loaders/FlorenceLoader.ts`

### Key Changes Made

1. **Updated URL Generation** (lines 590-595):
   ```typescript
   // OLD - Native API
   return `https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/${collection}/${page.id}/default.jpg`;
   
   // NEW - IIIF Image API  
   return `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${page.id}/full/max/0/default.jpg`;
   ```

2. **Updated Validation Methods** (lines 118, 163, 277):
   - Changed `testImageAccess()` to use IIIF API
   - Updated `validatePageAccessibility()` to test IIIF endpoints
   - Updated `validateAllPages()` for consistency

3. **Updated Log Messages and Comments**:
   - Changed "ContentDM native API" references to "ContentDM IIIF API"
   - Updated success messages to reflect "maximum resolution"

## IIIF Image API Parameters Explained

### URL Structure
```
https://cdm21059.contentdm.oclc.org/digital/iiif/{collection}/{id}/{region}/{size}/{rotation}/{quality}.{format}
```

### Parameter Breakdown
- **Region**: `full` - Extract the entire image
- **Size**: `max` - Maximum available size without upscaling  
- **Rotation**: `0` - No rotation
- **Quality**: `default` - Default quality
- **Format**: `jpg` - JPEG format

### Alternative Size Parameters Tested
| Parameter | Result | File Size | Notes |
|-----------|--------|-----------|-------|
| `full/max/0/default.jpg` | ✅ Success | 1,160KB | **OPTIMAL** - Maximum resolution |
| `full/full/0/default.jpg` | ✅ Success | 1,160KB | Equivalent to `max` |
| `full/pct:100/0/default.jpg` | ✅ Success | 1,160KB | 100% scale |
| `full/3579,/0/default.jpg` | ✅ Success | 1,160KB | Exact width specification |
| `full/4000,/0/default.jpg` | ❌ Failed | 50 bytes | Server returns 501 NOT_IMPLEMENTED |
| `full/2000,/0/default.jpg` | ✅ Success | 384KB | Downscaled version |

## ContentDM IIIF Compliance

The Florence instance (`cdm21059.contentdm.oclc.org`) supports:
- **IIIF Image API v2.0** (confirmed via info.json)
- **Level 1 compliance** (basic transformations)
- **Tile support** with scale factors [1, 2, 4, 8, 16]
- **Size variants** up to maximum image dimensions

### Info.json Response
```json
{
  "@context": "http://iiif.io/api/image/2/context.json",
  "@id": "https://cdm21059.contentdm.oclc.org/digital/iiif/plutei/24932",
  "height": 4957,
  "width": 3579,
  "profile": ["http://iiif.io/api/image/2/level1.json"],
  "protocol": "http://iiif.io/api/image"
}
```

## User Impact

### Before Fix
- Florence manuscripts downloaded at ~92KB per page
- Low resolution (894×1,239 pixels)
- Poor quality for scholarly use

### After Fix  
- Florence manuscripts download at ~1,133KB per page
- Maximum resolution (3,579×4,957 pixels)
- Excellent quality suitable for detailed scholarly research
- **12.3x improvement in file quality**

## Validation Test Results

```
🔍 Testing Florence ContentDM - Actual File Downloads
==================================================
📥 Downloading with OLD Native API (low resolution):
   ✅ SUCCESS: 94,510 bytes (92 KB)

📥 Downloading with NEW IIIF API (maximum resolution):
   ✅ SUCCESS: 1,160,148 bytes (1,133 KB)

📊 DETAILED COMPARISON:
   Old Native API: 94,510 bytes (92 KB)
   New IIIF API:   1,160,148 bytes (1,133 KB)
   File Size Ratio: 12.3x larger

🎉 OUTSTANDING: 10x+ improvement! Perfect high-resolution implementation

📥 Testing second page (24933) for consistency:
   ✅ Page 2: 1,251,313 bytes (1,222 KB) - Consistent high resolution
```

## Conclusion

The Florence ContentDM API fix successfully implements maximum resolution downloads by switching from the native API to the IIIF Image API. Users now receive **12.3x larger files** with **4x better resolution** in both dimensions, providing scholarly-quality manuscript images instead of low-resolution previews.

**Status**: ✅ COMPLETE - Ready for production deployment