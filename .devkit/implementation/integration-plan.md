# Integration Plan for Florence Intelligent Sizing

## Overview
This plan outlines how to integrate the intelligent page size determination system into the main Florence loader to prevent 403 errors while maximizing image quality.

## Files to Modify

### 1. Main Florence Loader
**File:** `/src/main/services/library-loaders/FlorenceLoader.ts`

**Changes Required:**
- Add intelligent sizing methods from `FlorenceLoaderWithIntelligentSizing.ts`
- Replace hardcoded 6000px width with dynamic size determination
- Add caching system for per-manuscript optimal sizes
- Implement progressive fallback with proper error handling

### 2. Enhanced Logging Integration
**File:** `/src/main/services/EnhancedLogger.ts` (if needed)

**Changes Required:**
- Ensure logger supports the detailed sizing information we log
- Add specific log levels for size testing and fallback behavior

## Integration Steps

### Step 1: Backup and Test Environment
```bash
# Backup current loader
cp src/main/services/library-loaders/FlorenceLoader.ts \
   .devkit/backup/FlorenceLoader.pre-intelligent-sizing.ts

# Test current implementation
bun .devkit/implementation/test-florence-intelligent-sizing.ts
```

### Step 2: Core Implementation Integration
1. **Add private methods** to existing FlorenceLoader class:
   - `testImageSize(collection, pageId, width): Promise<SizeTestResult>`
   - `determineOptimalSize(collection, samplePageId, manuscriptId): Promise<number>`
   - Add `SIZE_PREFERENCES` constant and `manuscriptSizeCache` map

2. **Replace sizing logic** in `loadManifest()`:
   ```typescript
   // OLD (line 239):
   return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`;
   
   // NEW:
   const firstPageId = pages[0].id;
   const manuscriptId = `${collection}:${itemId}`;
   const optimalWidth = await this.determineOptimalSize(collection, firstPageId, manuscriptId);
   
   const pageLinks = pages.map(page => {
       return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/${optimalWidth},/0/default.jpg`;
   });
   ```

### Step 3: Error Handling Enhancement
- Update existing try-catch blocks to handle size-related errors
- Add specific error messages for different failure types (403, 404, 500, timeout)
- Ensure graceful fallback to smallest size if all tests fail

### Step 4: Logging Integration
- Add detailed logging for size determination process
- Log cache hits/misses for performance monitoring
- Include sizing information in success messages

### Step 5: Testing and Validation
```bash
# Test with problematic manuscript
bun test-florence-manuscript-217710.ts

# Test with current working manuscript  
bun test-florence-manuscript-317515.ts

# Run existing Playwright tests
npm run test:e2e:florence

# Full build test
npm run build
```

## Testing Validation Criteria

### ✅ Success Criteria
- Manuscript 217710 (if it exists) loads without 403 errors
- Current working manuscripts (317515) still get maximum quality when possible
- Intelligent fallback works for restricted manuscripts
- Performance impact is minimal (< 2 seconds additional for size testing)
- Caching prevents repeated size testing for same manuscripts

### ❌ Failure Indicators
- Any previously working manuscript stops working
- All manuscripts default to lowest resolution unnecessarily
- Size testing takes too long (> 5 seconds per manuscript)
- 403 errors still occur after fallback implementation

## Rollback Plan
If integration causes issues:
```bash
# Immediate rollback
cp .devkit/backup/FlorenceLoader.pre-intelligent-sizing.ts \
   src/main/services/library-loaders/FlorenceLoader.ts

# Test rollback works
npm run build && npm run test:e2e:florence

# Analyze what went wrong
git diff HEAD~1 HEAD src/main/services/library-loaders/FlorenceLoader.ts
```

## Performance Considerations

### Optimization Strategies
1. **HEAD requests only** for size testing (avoid downloading image data)
2. **Size caching** prevents retesting same manuscripts
3. **Fast timeout** (5 seconds) for size testing to avoid hanging
4. **Progressive testing** stops at first working size (usually 6000px for unrestricted)

### Expected Performance Impact
- **First load:** +1-3 seconds for size testing
- **Cached loads:** +0ms (cache hit)
- **403 Restricted manuscripts:** Actually faster (no failed 6000px downloads)

## Monitoring and Maintenance

### Key Metrics to Watch
- Distribution of chosen sizes across manuscripts
- Cache hit rate for size determination
- Frequency of 403 errors before and after implementation
- Average time for manifest loading

### Logs to Monitor
```
[INFO] Using cached optimal size: 4000px for manuscript plutei:217710
[INFO] Optimal size determined: 2048px for manuscript plutei:217710 (responseTime: 234ms)
[WARN] Size 6000px failed for manuscript plutei:217710: HTTP 403: Forbidden
[ERROR] All size tests failed for manuscript plutei:123456, using fallback size: 800px
```

## Future Enhancements

### Phase 2 Improvements
1. **Machine Learning**: Learn optimal sizes based on manuscript characteristics
2. **Batch Testing**: Test multiple manuscripts' sizes simultaneously
3. **User Preferences**: Allow users to set quality vs speed preferences
4. **Global Caching**: Share size information across users (with privacy considerations)

### Server-Specific Adaptations  
- Adapt algorithm for other ContentDM servers beyond Florence
- Handle different IIIF server implementations with varying size limits
- Add server-specific size preference profiles