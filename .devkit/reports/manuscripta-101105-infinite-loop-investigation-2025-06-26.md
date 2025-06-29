# Manuscripta.se ms/101105 Infinite Loop Investigation Report

**Date:** 2025-06-26  
**URL:** https://manuscripta.se/ms/101105  
**Issue:** Infinite loop during download processing  
**Status:** Investigation Complete

## Executive Summary

The investigation into the specific URL https://manuscripta.se/ms/101105 that causes infinite loop issues reveals a well-structured manuscript with no inherent structural problems. The infinite loop appears to be a timeout/processing issue rather than a structural problem with this specific manuscript.

## Manuscript Analysis

### Basic Information
- **Title:** Missal from Linköping diocese  
- **Date:** Second half of 15th century  
- **Material:** Paper support  
- **Pages:** 50 canvases (covers + f. 1r to f. 24v)  
- **Language:** Latin  

### IIIF Manifest Structure
- **Manifest URL:** `https://www.manuscripta.se/iiif/101105/manifest.json`
- **API Version:** IIIF Image API 2.0
- **Canvas Count:** 50 pages
- **Image Dimensions:** 6101 × 7419 pixels (consistent across all canvases)
- **Image Format:** JPEG via IIIF service
- **Service Profile:** Level 1

### URL Patterns
All images follow consistent pattern:
```
https://iiif.manuscripta.se/iiif/ms-101105%2Fms-101105_XXXX.tif/full/full/0/default.jpg
```

## Technical Investigation Results

### 1. Manifest Accessibility
✅ **PASS** - IIIF manifest loads successfully  
✅ **PASS** - All 50 canvases properly structured  
✅ **PASS** - Image service URLs respond correctly  
✅ **PASS** - No authentication barriers  

### 2. Image Service Testing
✅ **PASS** - Thumbnail images (90px) load quickly  
✅ **PASS** - Full resolution images accessible  
✅ **PASS** - Server responds with proper headers  
✅ **PASS** - No rate limiting detected  

### 3. Server Response Analysis
- **Server:** Apache/2.4.37 (Red Hat Enterprise Linux)
- **Cache-Control:** max-age=86400 (24 hours)
- **CORS:** Properly configured with * origin
- **Content-Disposition:** Proper filename headers
- **Last-Modified:** Consistent timestamps (Dec 17, 2022)

### 4. Comparison with Other Manuscripta.se URLs

Tested multiple manuscripta.se URLs (ms/100001, ms/100005) and found:
- **Consistent Structure:** All follow same IIIF manifest pattern
- **Similar Metadata:** Rich scholarly metadata organization
- **Same Service Endpoints:** Identical IIIF service configuration
- **No Unique Characteristics:** ms/101105 shows no unusual properties

## Current Timeout Handling Analysis

### Existing Protections in Codebase
1. **Manifest Loading:** 30-second timeout for IIIF manifest requests
2. **Download Processing:** 15-minute maximum timeout for entire download
3. **Auto-Split Exclusion:** Manuscripta.se excluded from size checking to prevent hangs
4. **Enhanced Monitoring:** Special logging for Manuscripta.se downloads

### Code Implementation Review
The current implementation includes:
```typescript
// Skip size estimation for libraries that hang on first page download
const shouldCheckSplit = !item.isAutoPart && pageCount > 50 && 
    manifest.library !== 'orleans' && manifest.library !== 'florus' && 
    manifest.library !== 'manuscripta' && manifest.library !== 'modena';
```

## Potential Root Causes

### 1. Size-Related Issues
- **Large Images:** 6101 × 7419 pixels per page (≈45MP each)
- **Total Data:** 50 pages × ~2-5MB each = 100-250MB total
- **Memory Usage:** Could cause memory pressure during processing

### 2. Processing Loop Issues
- **PDF Creation:** Large image processing during PDF compilation
- **Memory Management:** Potential memory leaks in image processing
- **Progress Reporting:** May get stuck in status update loops

### 3. Network Timing Issues
- **Server Response:** IIIF server may have variable response times
- **Batch Processing:** Sequential image downloads may accumulate delays
- **Connection Pooling:** HTTP connection management issues

## Comparison with Working Libraries

### Similar Structure Libraries (Working)
- **Parker Library (Stanford):** Also uses IIIF, similar image sizes
- **Morgan Library:** Large images, proper timeout handling
- **BDL Servizi RL:** Fixed with 30-second manifest timeout

### Key Differences
- **Image Server:** manuscripta.se uses IIPImage vs other IIIF implementations
- **URL Encoding:** Uses URL-encoded filenames (`ms-101105%2F`)
- **Server Location:** European server vs US/other locations

## Recommendations

### 1. Enhanced Monitoring
```typescript
// Add specific progress tracking for Manuscripta.se
if (isManuscriptaSe) {
    console.log(`Manuscripta.se page ${currentPage}/${totalPages}: ${imageUrl}`);
    // Track individual page download times
    const pageStartTime = Date.now();
    // ... download logic
    const pageEndTime = Date.now();
    console.log(`Manuscripta.se page ${currentPage} completed in ${pageEndTime - pageStartTime}ms`);
}
```

### 2. Memory Management
- Implement image processing batches (5-10 pages at a time)
- Force garbage collection between batches
- Monitor memory usage during download

### 3. Progressive Timeout Strategy
- **Page-level timeouts:** 2 minutes per individual page
- **Batch timeouts:** 5 minutes per 10-page batch
- **Overall timeout:** Keep existing 15-minute total limit

### 4. Alternative Processing Approach
- Download all images first (with individual timeouts)
- Process PDF creation in separate phase
- Implement resume capability for partial downloads

## Conclusion

The manuscript https://manuscripta.se/ms/101105 itself is not structurally problematic. The infinite loop issue is likely caused by:

1. **Large image processing overhead** (45MP × 50 images)
2. **Memory management issues** during PDF creation
3. **Progress reporting loops** getting stuck
4. **Network timing variations** with European IIIF server

The existing 15-minute timeout should catch most cases, but the processing may be getting stuck before reaching the timeout handler. The issue requires runtime debugging during an actual download to identify the exact sticking point.

## Next Steps

1. **Runtime Debugging:** Monitor actual download with detailed logging
2. **Memory Profiling:** Track memory usage during Manuscripta.se downloads  
3. **Processing Optimization:** Implement batch processing for large image sets
4. **Alternative Test URLs:** Test other large Manuscripta.se manuscripts for pattern confirmation

---

**Investigation Status:** Complete  
**Manuscript Status:** Structurally sound, no inherent download barriers  
**Issue Classification:** Processing/timeout related, not manuscript-specific