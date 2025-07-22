# BDL (Biblioteca Digitale Lombarda) Fix Report

**Date:** July 22, 2025  
**Issue:** BDL manuscript downloads were failing due to API endpoint change  
**Status:** ✅ FIXED

## Problem Summary

The BDL library was failing to download manuscripts because the API endpoint had changed:
- **Old endpoint:** `/bdl/fe/rest/json/item/{id}/bookreader/pages` (404 Not Found)
- **New endpoint:** `/bdl/public/rest/json/item/{id}/bookreader/pages` (200 OK)

## Solution Applied

Modified the `loadBDLManifest` function in `EnhancedManuscriptDownloaderService.ts`:
- Changed the API path from using `fe` to always use `public`
- The new endpoint works for all manuscripts tested

## Validation Results

### API Testing
- ✅ New endpoint returns valid JSON with page data
- ✅ Response includes `idMediaServer` for IIIF image URLs
- ✅ Successfully tested with manuscripts 3903 and 3904

### Image Download Testing
- ✅ Images download successfully using IIIF URLs
- ✅ High resolution images (2000+ pixels width)
- ⚠️ Occasional HTTP 500 errors on some images (server-side issue)
- ✅ Retry mechanism handles transient failures

### PDF Creation Testing
- ✅ Successfully created PDFs from downloaded images
- ✅ PDF validation passes with poppler tools
- ✅ Images show correct manuscript content
- ✅ Different pages contain different content (no duplicates)

### Content Validation
Inspected downloaded manuscript pages:
- Page 1: Manuscript cover (leather binding)
- Page 5: Blank page 
- Page 10: Musical notation (neumes) - Graduale content

## Technical Details

**Fixed endpoint:**
```
https://www.bdl.servizirl.it/bdl/public/rest/json/item/{manuscriptId}/bookreader/pages
```

**IIIF Image URL pattern:**
```
https://www.bdl.servizirl.it/cantaloupe/iiif/2/{idMediaServer}/full/max/0/default.jpg
```

## Remaining Issues

1. BDL's IIIF server occasionally returns HTTP 500 errors
2. Some image downloads may timeout due to server load
3. Retry mechanism mitigates these issues but doesn't eliminate them

## Conclusion

The BDL library is now functional again with the updated API endpoint. Users can successfully download manuscripts from Biblioteca Digitale Lombarda, though they may experience occasional server-side errors that are handled by the retry mechanism.