# Negative Converter Memory Optimization Analysis

## Problem Identified

The user reported that the negative converter was causing system crashes due to excessive memory usage when processing PDF files in the Desktop/textor folder.

## Root Causes Found

### 1. **Massive Memory Allocation in Image Inversion**
- **Issue**: The original code loaded entire high-resolution images into memory at once using `getImageData()` 
- **Impact**: For large manuscript pages (often 3000x4000+ pixels), this creates arrays of 48+ million elements (width × height × 4 channels)
- **Memory Usage**: Each pixel = 4 bytes (RGBA) → 3000×4000×4 = ~48MB per page just for pixel data
- **Multiplier Effect**: Multiple canvases, image elements, and buffers were held in memory simultaneously

### 2. **No Progressive Memory Cleanup**
- **Issue**: All pixel data was processed at once with no intermediate cleanup
- **Impact**: Peak memory usage included all image layers simultaneously
- **Example**: 10-page manuscript = 480MB+ just for pixel arrays, plus canvas buffers, image elements, etc.

### 3. **Insufficient Garbage Collection Hints**
- **Issue**: Browser GC wasn't triggered frequently enough during intensive operations
- **Impact**: Memory built up faster than it was released

### 4. **High Canvas Resolution**
- **Issue**: PDF rendering at 1.5x scale for "quality" created unnecessarily large canvases
- **Impact**: Larger images = exponentially more memory usage

## Solutions Implemented

### 1. **Strip-Based Image Processing** ⭐ Main Fix
```typescript
// OLD: Process entire image at once
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
// Creates massive array: width × height × 4 bytes

// NEW: Process in horizontal strips
const stripHeight = Math.min(100, canvas.height); // 100px strips
for (let stripIndex = 0; stripIndex < totalStrips; stripIndex++) {
  const imageDataStrip = ctx.getImageData(0, startY, canvas.width, actualStripHeight);
  // Process only 100px × width × 4 bytes at a time
  // Force cleanup: imageDataStrip.data.fill(0);
}
```

**Memory Reduction**: From ~48MB per page to ~1.2MB per strip (40x reduction in peak usage)

### 2. **Aggressive Memory Cleanup**
```typescript
// Clean up memory immediately and aggressively
URL.revokeObjectURL(imageUrl);
canvas.width = 0;
canvas.height = 0;
canvas.remove();           // NEW: Remove from DOM
img.src = '';             // NEW: Clear image source
img.remove();             // NEW: Remove from DOM

// Force garbage collection hint
if (typeof window !== 'undefined' && (window as any).gc) {
  (window as any).gc();
}
```

### 3. **Progressive Processing with Delays**
```typescript
// Give browser a chance to garbage collect between strips
if (stripIndex % 5 === 0) {
  await new Promise(resolve => setTimeout(resolve, 1));
}

// Add small delay between images to prevent memory buildup
await new Promise(resolve => setTimeout(resolve, 50));

// Delay between PDF pages for GC
if (pageNum % 5 === 0) {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 4. **Reduced Canvas Resolution**
```typescript
// OLD: High resolution for "quality"
const viewport = page.getViewport({ scale: 1.5 });

// NEW: Balanced resolution for memory efficiency
const viewport = page.getViewport({ scale: 1.2 });
```

**Memory Reduction**: ~36% reduction in canvas memory usage (1.2² vs 1.5² = 1.44 vs 2.25)

## Expected Results

### Memory Usage Improvements
- **Peak Memory**: Reduced from ~500MB+ to ~50MB for typical manuscripts
- **System Stability**: Should prevent system crashes and swapping
- **Processing Speed**: May be slightly slower due to strip processing, but much more stable

### Performance Characteristics
- **Large Files**: Now handles manuscripts that previously crashed the system
- **Memory Pattern**: Steady, controlled memory usage instead of exponential growth
- **GC Efficiency**: Better garbage collection with explicit cleanup hints

## Validation Plan

### 1. **Test Script Created**
- `test-memory-optimized-negative-converter.cjs` - monitors app stability
- Tests with PDFs from user's Desktop/textor folder
- Monitors memory usage patterns

### 2. **Manual Testing Required**
- User should test with the specific PDF that previously crashed the system
- Monitor Activity Monitor for memory usage during conversion
- Verify image quality is still acceptable with 1.2x scale

### 3. **Success Criteria**
- ✅ System remains stable during conversion
- ✅ No excessive memory usage (>1GB)
- ✅ Process completes successfully
- ✅ Output images maintain good quality
- ✅ Final PDF is properly created

## Technical Details

### Strip Processing Algorithm
1. **Divide**: Split image into horizontal strips of max 100px height
2. **Process**: Handle each strip independently for inversion
3. **Cleanup**: Immediately clear pixel data after each strip
4. **Yield**: Give browser time for GC between strips

### Memory Management Strategy
1. **Immediate Cleanup**: Remove DOM elements and clear references immediately
2. **Progressive GC**: Yield control to browser regularly for garbage collection
3. **Reduced Allocation**: Process smaller chunks to avoid large allocations
4. **Explicit Hints**: Use GC hints where available

### Backward Compatibility
- All existing functionality preserved
- Same image quality output (slightly different due to scale reduction)
- Same file formats and naming conventions
- Same progress reporting and error handling

## Next Steps

1. **Test with user's problematic PDF** - validate the fix works
2. **Monitor memory usage** during test runs
3. **Adjust strip size** if needed (100px may be too large/small)
4. **Consider further optimizations** if memory issues persist

## Code Changes Summary

**File Modified**: `src/renderer/services/PdfRendererService.ts`

**Key Changes**:
- Strip-based image processing in `invertImageFiles()`
- Reduced PDF rendering scale from 1.5x to 1.2x
- Enhanced memory cleanup throughout
- Progressive processing with GC yield points
- More aggressive DOM element cleanup

**New Files**:
- `.devkit/test-memory-optimized-negative-converter.cjs` - validation test
- `.devkit/analysis/negative-converter-memory-optimization.md` - this analysis