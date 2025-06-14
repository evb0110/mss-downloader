# Manuscript Library URL Audit Results

## Executive Summary

I conducted a comprehensive audit of all supported library examples in the Electron app, comparing them with the reference project at `/Users/e.barsky/Desktop/Personal/site/barsky.club`. The audit identified several critical issues with URL examples that were pointing to non-functional pages, list pages instead of manuscript viewers, or using outdated manuscript IDs.

## Issues Found

### 1. **Broken/Outdated URLs**
- **Gallica URL**: `https://gallica.bnf.fr/ark:/12148/btv1b10500687g` (from reference project)
  - **Issue**: Returns HTTP 400 error - manuscript ID is outdated or invalid
  - **Status**: Removed from examples

### 2. **List Pages Instead of Viewer Pages**
- **e-codices URLs**: All `/list/one/` format URLs
  - **Examples**: 
    - `https://www.e-codices.unifr.ch/en/list/one/zbz/C0043`
    - `https://www.e-codices.unifr.ch/en/list/one/ubb/A-V-43`
    - `https://www.e-codices.unifr.ch/en/list/one/bge/ms-lat-55`
    - `https://www.e-codices.unifr.ch/en/list/one/csg/Sang_1395`
  - **Issue**: These are manuscript overview/metadata pages, not direct viewers
  - **Fix**: Updated to use `/1r` suffix for direct page viewing
  - **New format**: `https://www.e-codices.unifr.ch/en/[library]/[manuscript]/1r`

### 3. **Missing Examples**
- **Gallica**: Missing diverse manuscript examples
- **Vatican**: Missing Palatine collection example
- **Cecilia**: Missing additional working examples
- **British Library**: Missing multiple format examples and direct manifest URLs

## URLs Updated

### **Gallica (BnF)**
**Before:**
- `btv1b8449691v/f1.planchecontact`
- `btv1b8449691v/f1.highres` 
- `btv1b8449691v/f1.image`

**After:**
- `btv1b84922882/f1.highres` (Standard .highres format)
- `btv1b8449691v/f1.planchecontact` (Planche contact format) 
- `btv1b8449681v/f1.highres` (High resolution format)

### **e-codices (Unifr)**
**Before:**
- `https://www.e-codices.unifr.ch/en/zbz/C0043/1r` ✅
- `https://www.e-codices.unifr.ch/en/list/one/zbz/C0043` ❌ (list page)

**After:**
- `https://www.e-codices.unifr.ch/en/zbz/C0043/1r` (Zurich Central Library)
- `https://www.e-codices.unifr.ch/en/ubb/A-V-43/1r` (Basel University Library)
- `https://www.e-codices.unifr.ch/en/bge/ms-lat-55/1r` (Geneva Library)
- `https://www.e-codices.unifr.ch/en/csg/Sang_1395/1r` (St. Gall Library)

### **Vatican Library**
**Before:**
- `MSS_Vat.lat.3225` ✅
- `MSS_Vat.gr.1613` ✅

**After:**
- `MSS_Vat.lat.3225` (Vatican Latin manuscript)
- `MSS_Pal.lat.24` (Palatine Latin manuscript)
- `MSS_Vat.gr.1613` (Vatican Greek manuscript)

### **Cecilia (Grand Albigeois)**
**Before:**
- `viewer/124/` only

**After:**
- `viewer/124/` (Document 124 example)
- `viewer/105/` (Document 105 - Liber sacramentorum, 9th century)

### **British Library**
**Before:**
- One complex UV viewer URL only

**After:**
- Stavelot Missal (UV viewer)
- Another manuscript (alternative UV viewer)
- Third manuscript (another UV viewer)
- Direct manifest URL (`https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001`)

## Key URL Format Guidelines

### **Working URL Patterns:**

1. **Gallica**: `https://gallica.bnf.fr/ark:/12148/[ID]/f1.[format]`
   - Formats: `.highres`, `.planchecontact`, `.image`

2. **e-codices**: `https://www.e-codices.unifr.ch/en/[library]/[manuscript]/1r`
   - Libraries: `zbz`, `ubb`, `bge`, `csg`
   - Always end with `/1r` for first page view

3. **Vatican**: `https://digi.vatlib.it/view/[collection].[manuscript]`
   - Collections: `MSS_Vat.lat`, `MSS_Pal.lat`, `MSS_Vat.gr`

4. **British Library**: Direct IIIF manifest URLs work best
   - Format: `https://bl.digirati.io/iiif/ark:/81055/[id]`

### **Problematic Patterns to Avoid:**

1. **List/Overview Pages**: URLs containing `/list/one/` or similar
2. **Outdated IDs**: Always verify manuscript IDs are current
3. **Complex Tracking URLs**: Prefer clean URLs without analytics parameters when possible
4. **Indirect Viewers**: URLs that require additional navigation to reach the actual manuscript

## Testing Recommendations

For future URL validation:
1. Test each URL manually in a browser
2. Verify it loads actual manuscript images, not metadata pages  
3. Check that the URL format matches the expected pattern for that library
4. Ensure the manuscript ID is current and accessible
5. Test with the app's manifest parsing to verify compatibility

## Files Updated

1. **`/src/renderer/components/DownloadQueueManager.vue`**
   - Updated `supportedLibrariesComplete` array with corrected examples
   - Added more diverse examples for each library
   - Fixed e-codices URLs to use direct viewer format

2. **`/src/main/services/EnhancedManuscriptDownloaderService.ts`**
   - Updated `SUPPORTED_LIBRARIES` array with better primary examples
   - Changed Gallica example to tested working URL
   - Updated British Library to use direct IIIF manifest URL

## Verification Status

✅ **All updated URLs verified working through web testing**
✅ **Build successful with no errors**  
✅ **URL formats align with reference project best practices**
✅ **Removed all broken/problematic examples**
✅ **Added diverse examples covering multiple institutions per library**

The audit successfully identified and resolved all major URL issues, ensuring that users will have reliable, working examples for each supported manuscript library.