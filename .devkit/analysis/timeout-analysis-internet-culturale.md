# Timeout Configuration Analysis - InternetCulturale Library

## Issue Summary
A 842-page manuscript from InternetCulturale library is timing out after 45 minutes during download.

**URL:** https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD%5C%5C00000171777

**Error:** `Download timeout - exceeded 45 minutes. Large manuscripts (842 pages) may require manual splitting.`

## Current Timeout System Analysis

### 1. Base Timeout Configuration (EnhancedDownloadQueue.ts lines 562-578)
```typescript
// Calculate dynamic timeout based on file size and library
const baseTimeoutMinutes = 15;
let timeoutMultiplier = 1;

// Large manuscripts need significantly more time
if (item.totalPages && item.totalPages > 300) {
    timeoutMultiplier = 3; // 45 minutes for 300+ pages
} else if (item.totalPages && item.totalPages > 200) {
    timeoutMultiplier = 2; // 30 minutes for 200+ pages
}

// Manuscripta.se specifically needs extra time due to large file sizes
if (item.library === 'manuscripta' && item.totalPages && item.totalPages > 100) {
    timeoutMultiplier = Math.max(timeoutMultiplier, 3); // At least 45 minutes
}

const downloadTimeoutMs = baseTimeoutMinutes * timeoutMultiplier * 60 * 1000;
```

**Current timeout for 842-page manuscript:**
- Base: 15 minutes
- Pages > 300: 3x multiplier  
- Total: 15 × 3 = **45 minutes** (2,700,000ms)

### 2. InternetCulturale Library Optimizations (LibraryOptimizationService.ts lines 37-42)
```typescript
'internet_culturale': {
    maxConcurrentDownloads: 4, // Italian platform with moderate limits - increased for better performance
    timeoutMultiplier: 1.5,
    enableProgressiveBackoff: true,
    optimizationDescription: 'Internet Culturale optimizations: 4 concurrent downloads, extended timeouts with progressive backoff'
},
```

**Library-specific timeout multiplier:** 1.5x (but not applied to queue timeout)

### 3. Size Estimation Logic (EnhancedDownloadQueue.ts lines 971-1002)
```typescript
// For Florus, Orleans, Internet Culturale, Manuscripta, Graz, Cologne, Rome, NYPL, Czech, and Modena 
// - skip first page download and use estimated size calculation
if (manifest.library === 'internet_culturale') {
    console.log(`${manifest.library} manuscript detected, using estimated size calculation`);
    // Estimate based on typical manuscript page size
    const avgPageSizeMB = 0.8; // 800KB for Internet Culturale IIIF
    const estimatedTotalSizeMB = avgPageSizeMB * manifest.totalPages;
    item.estimatedSizeMB = estimatedTotalSizeMB;
    
    // Check against threshold
    if (estimatedTotalSizeMB > effectiveThreshold) {
        console.log(`${manifest.library} manuscript exceeds threshold, splitting into parts`);
        await this.splitQueueItem(item, manifest, estimatedTotalSizeMB);
        return true;
    }
}
```

**Size calculation for 842 pages:**
- Average page size: 0.8MB
- Total estimated: 842 × 0.8 = **673.6MB**
- Default auto-split threshold: 800MB
- Result: **No auto-splitting** (673.6MB < 800MB)

## Problem Analysis

### Root Cause
1. **No Library-Specific Timeout Application**: The queue timeout logic doesn't apply InternetCulturale's 1.5x timeout multiplier
2. **Insufficient Timeout for Large Downloads**: 45 minutes may be insufficient for 842 pages with 4 concurrent downloads
3. **Auto-Split Not Triggered**: 673.6MB estimated size doesn't exceed 800MB threshold, so no splitting occurs
4. **No Page-Based Timeout Scaling**: Timeout only considers 300+ pages threshold, not progressive scaling

### Expected Download Time Calculation
```
842 pages ÷ 4 concurrent = 210.5 page batches
Average download time per page ≈ 10-15 seconds (including IIIF processing)
Total time: 210.5 × 12s ≈ 42 minutes (close to 45-minute limit)
```

**With network delays, server throttling, and progressive backoff, 45 minutes is insufficient.**

## Recommended Solutions

### 1. Apply Library-Specific Timeout Multiplier to Queue Timeout
**Location:** `EnhancedDownloadQueue.ts` lines 577-578

**Current:**
```typescript
const downloadTimeoutMs = baseTimeoutMinutes * timeoutMultiplier * 60 * 1000;
```

**Proposed:**
```typescript
// Apply library-specific timeout multiplier
const libraryTimeoutMultiplier = item.libraryOptimizations?.timeoutMultiplier || 1.0;
const finalTimeoutMultiplier = timeoutMultiplier * libraryTimeoutMultiplier;
const downloadTimeoutMs = baseTimeoutMinutes * finalTimeoutMultiplier * 60 * 1000;
```

**Result for InternetCulturale 842 pages:**
- Base: 15 minutes
- Page multiplier: 3x (300+ pages)
- Library multiplier: 1.5x
- Total: 15 × 3 × 1.5 = **67.5 minutes**

### 2. Implement Progressive Page-Based Timeout Scaling
**Location:** `EnhancedDownloadQueue.ts` lines 566-576

**Proposed:**
```typescript
// Progressive scaling for very large manuscripts
if (item.totalPages && item.totalPages > 500) {
    const pageScaleFactor = Math.min(item.totalPages / 300, 4); // Cap at 4x
    timeoutMultiplier = Math.max(timeoutMultiplier, pageScaleFactor);
} else if (item.totalPages && item.totalPages > 300) {
    timeoutMultiplier = 3;
} else if (item.totalPages && item.totalPages > 200) {
    timeoutMultiplier = 2;
}
```

**Result for 842 pages:**
- Page scale factor: min(842/300, 4) = min(2.81, 4) = 2.81
- Timeout multiplier: max(3, 2.81) = 3 (existing logic preserved)

### 3. Lower Auto-Split Threshold for InternetCulturale
**Location:** `LibraryOptimizationService.ts` lines 37-42

**Proposed:**
```typescript
'internet_culturale': {
    autoSplitThresholdMB: 400, // Lower threshold for large manuscripts
    maxConcurrentDownloads: 4,
    timeoutMultiplier: 2.0, // Increase to 2.0x for large manuscripts
    enableProgressiveBackoff: true,
    optimizationDescription: 'Internet Culturale optimizations: 400MB split threshold, 4 concurrent downloads, 2x timeouts with progressive backoff'
},
```

**Result for 842 pages:**
- Estimated size: 673.6MB
- Split threshold: 400MB
- Result: **Auto-split into 2 parts** (673.6MB > 400MB)
- Part 1: ~421 pages (~337MB)
- Part 2: ~421 pages (~337MB)

### 4. Enhanced Error Recovery for Large Downloads
**Location:** `EnhancedDownloadQueue.ts` processItem method

**Proposed:** Add chunked download resumption capability:
```typescript
// For very large downloads, implement chunked resumption
if (item.totalPages > 500 && error.message?.includes('timeout')) {
    console.log(`Large download timeout detected, attempting chunked resumption`);
    // Split into smaller chunks and resume from last successful page
    return await this.resumeWithChunking(item, manifest);
}
```

## Impact Assessment

### Current Behavior (842-page InternetCulturale)
- ❌ Downloads as single file (673.6MB)
- ❌ 45-minute timeout insufficient
- ❌ No library-specific timeout applied
- ❌ Download fails after 45 minutes

### With Proposed Fixes
- ✅ **Solution 1:** 67.5-minute timeout (45min × 1.5x library multiplier)
- ✅ **Solution 3:** Auto-split into 2 parts (~421 pages each)
- ✅ **Both solutions:** Significantly higher success rate
- ✅ **Progressive backoff:** Better handling of server throttling

## Implementation Priority

1. **High Priority - Solution 1:** Apply library timeout multiplier (immediate fix)
2. **High Priority - Solution 3:** Lower InternetCulturale auto-split threshold (prevents future issues)
3. **Medium Priority - Solution 2:** Progressive page-based scaling (handles edge cases)
4. **Low Priority - Solution 4:** Chunked resumption (complex feature for rare cases)

## Testing Recommendations

1. **Test URL:** https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD%5C%5C00000171777
2. **Verify:** Auto-split behavior with 400MB threshold
3. **Verify:** 67.5-minute timeout with library multiplier
4. **Monitor:** Download success rate for 500+ page manuscripts
5. **Performance:** Ensure concurrent downloads don't overwhelm server

## Related Files to Modify

1. `/src/main/services/EnhancedDownloadQueue.ts` - Apply library timeout multiplier
2. `/src/main/services/LibraryOptimizationService.ts` - Update InternetCulturale settings
3. `/tests/e2e/` - Add test case for large InternetCulturale manuscripts
4. `/florence-performance-test.js` - Update test to verify timeout improvements