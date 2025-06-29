# Internet Culturale PDF Creation Investigation Report

**Date:** June 29, 2025  
**Issue:** PDF files contain repeated library pages instead of actual manuscript images  
**Status:** INVESTIGATION IN PROGRESS  

## Problem Summary

User reports that Internet Culturale downloads create PDFs where the same library page is repeated for each page instead of actual manuscript content. The manifest loading works correctly (finds 578 pages), individual image URLs download valid JPEGs, but the final PDF contains wrong content.

## Code Analysis Findings

### 1. Internet Culturale Implementation Structure

**Manifest Loading:** `loadInternetCulturaleManifest()` (line 3788)
- Extracts OAI identifier from URL
- Calls API: `https://www.internetculturale.it/jmms/magparser?id={oaiId}&teca={teca}&mode=all&fulltext=0`
- Parses XML response for `<page src="...">` elements
- **Critical Fix Already Present (lines 3853-3855):**
  ```typescript
  // Fix Florence URL issue: use 'web' instead of 'normal' for working images
  if (relativePath.includes('cacheman/normal/')) {
      relativePath = relativePath.replace('cacheman/normal/', 'cacheman/web/');
  }
  ```
- Converts relative paths to absolute URLs: `https://www.internetculturale.it/jmms/${relativePath}`

### 2. Image Download Pipeline

**Download Process:** `downloadManuscript()` (line 1665)
- Downloads images to temporary directory with pattern: `{sanitizedName}_page_{pageIndex + 1}.jpg`
- Stores image paths in `imagePaths` array
- Uses `downloadImageWithRetries()` with proxy fallback for Internet Culturale (line 1844)

**PDF Creation:** `convertImagesToPDFWithBlanks()` (line 2116)
- Reads image files from disk: `await fs.readFile(imagePath)` (line 2250)
- Embeds images in PDF: `await batchPdfDoc.embedJpg(imageBuffer)` (line 2254)
- Creates pages with original image dimensions: `batchPdfDoc.addPage([width, height])` (line 2298)

### 3. Potential Root Causes Analysis

#### A) **Image Caching Issue** 
The problem might be in the image file caching/saving mechanism:
- **Hypothesis:** Different image URLs resolve to the same cached content
- **Evidence:** The `normal` vs `web` path fix suggests server routing issues
- **Location:** `downloadImageWithRetries()` method and file writing logic

#### B) **PDF Worker Processing Issue**
The PDF worker processes images but might be receiving wrong data:
- **Location:** `src/workers/pdf-worker.ts` (lines 199-234)
- **Process:** `processImageForPDF()` creates canvas and converts to base64
- **Risk:** If all images have same content, the problem is upstream

#### C) **Server-Side Image Routing Problem**
Internet Culturale server might be serving the same image for different URLs:
- **Evidence:** The existing fix replacing "normal" with "web" suggests known server issues
- **Impact:** Even though URLs are different, server returns same content

#### D) **Proxy Fallback Side Effects**
Internet Culturale uses proxy fallback by default:
- **Code:** Line mentions proxy is used for `internetculturale.it` domains
- **Risk:** Proxy might be caching/serving wrong content

## Investigation Plan

### Phase 1: Small Batch Test (3-5 pages)
1. Download just 3-5 pages from Internet Culturale URL
2. Inspect actual downloaded image files before PDF creation
3. Verify each image file contains different content
4. Check if PDF creation preserves image differences

### Phase 2: Image URL Analysis  
1. Extract first 10 image URLs from manifest
2. Test direct download of each URL (no proxy)
3. Compare file sizes and content hashes
4. Verify server doesn't return same image for different URLs

### Phase 3: PDF Processing Analysis
1. Add logging to PDF creation pipeline
2. Track image processing at each stage:
   - File reading (`fs.readFile`)
   - PDF embedding (`embedJpg`/`embedPng`)
   - Page creation (`addPage`)

### Phase 4: Fix Implementation
Based on findings, implement targeted fix:
- If server issue: Enhance URL construction/routing
- If caching issue: Fix image storage/retrieval logic  
- If PDF issue: Fix image processing pipeline

## Files Requiring Investigation

1. **`src/main/services/EnhancedManuscriptDownloaderService.ts`**
   - `loadInternetCulturaleManifest()` (line 3788)
   - `downloadImageWithRetries()` (image download)
   - `convertImagesToPDFWithBlanks()` (line 2116)

2. **`src/workers/pdf-worker.ts`**
   - `processImageForPDF()` (lines 199-234)
   - Image-to-base64 conversion logic

3. **`src/main/services/EnhancedPdfMerger.ts`**
   - `addImageToPDF()` (line 39-89)
   - PDF embedding logic

## Next Actions

1. **Create focused test** for Internet Culturale with 3-5 pages only
2. **Log image content** at each pipeline stage
3. **Verify server behavior** - test if different URLs return different images
4. **Implement fix** based on root cause identification

---

**Investigation Status:** Ready for small batch testing phase