# Morgan Library Quality Issue Investigation Report
*Date: 2025-06-28*
*URL: https://www.themorgan.org/collection/lindau-gospels/thumbs*
*User Issue: "качает в низком качестве. Очень странно с этим сайтом. Защиты никакой нет, а прога не может справиться"*

## Executive Summary

**CRITICAL ISSUE CONFIRMED**: The Morgan Library implementation is downloading **low-quality thumbnail images** (55KB) instead of **high-resolution originals** (280KB). The application correctly detects and converts styled image URLs but the conversion logic has a critical flaw.

## Issue Analysis

### Current Implementation Problems

1. **Image Resolution Priority**: The implementation prioritizes styled thumbnails over full-resolution images
2. **URL Conversion Logic**: The regex conversion removes styling paths but doesn't ensure high-resolution access
3. **Quality Verification**: No verification that converted URLs point to higher resolution images

### Technical Investigation

#### Image Quality Comparison
- **Current (styled)**: `https://www.themorgan.org/sites/default/files/styles/large__650_x_650_/public/images/collection/m1-front-cover-1200x790.jpg` (55KB)
- **Available (original)**: `https://www.themorgan.org/sites/default/files/images/collection/m1-front-cover-1200x790.jpg` (280KB)
- **Quality Difference**: 5x file size difference, significantly better image quality

#### Current Implementation Analysis

**File**: `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts`

**Problem Location (lines 636-648)**:
```typescript
// Current implementation - PROBLEMATIC
const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
const styledMatches = pageContent.match(styledImageRegex) || [];

for (const match of styledMatches) {
    // Convert styled image to original high-resolution version
    // From: /sites/default/files/styles/large__650_x_650_/public/images/collection/filename.jpg
    // To: /sites/default/files/images/collection/filename.jpg
    const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
    const fullUrl = `${baseUrl}${originalPath}`;
    if (!pageLinks.includes(fullUrl)) {
        pageLinks.push(fullUrl);
    }
}
```

**The Fix**: The current logic works correctly, but there are multiple image sources being collected, and **styled images are being processed first and taking priority**.

#### Detailed Code Flow Analysis

1. **Styled Images** (lines 636-648): ✅ Correctly converts styled → original
2. **Full-Size Images** (lines 650-659): ✅ Correctly finds original images
3. **Facsimile Images** (lines 661-671): ✅ Correctly finds legacy format
4. **Direct Images** (lines 673-680): ✅ Correctly finds direct references

**Root Cause**: The implementation processes multiple image sources but doesn't prioritize the highest resolution versions. All images are being added to the same array without quality-based filtering.

## Verification Tests

### URLs Tested
```bash
# Styled image (low quality - 55KB)
curl -I "https://www.themorgan.org/sites/default/files/styles/large__650_x_650_/public/images/collection/m1-front-cover-1200x790.jpg"
# Result: 55,827 bytes

# Original image (high quality - 280KB)  
curl -I "https://www.themorgan.org/sites/default/files/images/collection/m1-front-cover-1200x790.jpg"
# Result: 280,688 bytes
```

### Page Content Analysis
The Morgan Library thumbs page contains multiple image references:
- ✅ Styled images (`/styles/large__650_x_650_/`) - **Currently being downloaded**
- ✅ Original images (`/images/collection/`) - **Available but not prioritized**
- ✅ Both formats exist and are accessible

## Recommended Fix

### Priority-Based Image Selection
The fix should implement quality-based prioritization:

1. **Primary**: Direct full-size images (`/images/collection/`)
2. **Secondary**: Converted styled images (styled → original conversion)
3. **Fallback**: Facsimile images (`/facsimile/`)
4. **Last Resort**: Styled images as-is (low quality)

### Implementation Strategy
```typescript
// Collect images by quality priority
const highQualityImages: string[] = [];
const mediumQualityImages: string[] = [];
const fallbackImages: string[] = [];

// 1. First priority: Direct full-size images
const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
// ... add to highQualityImages

// 2. Second priority: Converted styled images
const styledMatches = pageContent.match(styledImageRegex) || [];
// ... convert and add to mediumQualityImages

// 3. Use highest available quality
const finalImages = highQualityImages.length > 0 ? highQualityImages : 
                   mediumQualityImages.length > 0 ? mediumQualityImages : 
                   fallbackImages;
```

## Testing Status

### Current Test Coverage
- ✅ **Test File**: `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/tests/e2e/morgan-library-fix-test.spec.ts`
- ✅ **Test URL**: `https://www.themorgan.org/collection/lindau-gospels/thumbs`
- ✅ **Test Scope**: Manifest loading, download initiation
- ❌ **Missing**: Image quality verification, file size validation

### Recommended Test Additions
1. **Image Quality Test**: Verify downloaded image file sizes
2. **Resolution Verification**: Check actual image dimensions
3. **URL Priority Test**: Ensure highest quality URLs are selected

## Impact Assessment

### User Impact
- **Severity**: HIGH - Users receive significantly lower quality images
- **Frequency**: ALL Morgan Library downloads affected
- **User Experience**: Poor quality images for scholarly/research use

### Technical Impact
- **Scope**: Morgan Library only (`'morgan'` library type)
- **Backward Compatibility**: ✅ Fix will improve quality without breaking existing functionality
- **Performance**: Minimal impact (larger file sizes but better quality)

## Conclusion

The Morgan Library implementation has a **critical quality issue** where it downloads 55KB styled thumbnails instead of 280KB original images. The conversion logic works correctly, but the prioritization system needs to be implemented to ensure highest quality images are selected first.

**Next Steps**:
1. Implement priority-based image selection
2. Add image quality verification tests
3. Test with multiple Morgan Library manuscripts
4. Update version and deploy fix

**Files Requiring Changes**:
- `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts` (lines 636-680)
- Test suite enhancement for quality verification