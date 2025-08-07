# Manuscript Splitting Bug - Implementation Strategy & Risk Assessment

## Executive Summary

The manuscript splitting bug appears in the queue management system where split manuscripts get stuck with "queued" status instead of properly transitioning to download processing. This is a critical architectural issue affecting all libraries when large manuscripts are auto-split.

## Root Cause Analysis

### The Core Problem
1. **Status Mismatch**: Split manuscripts are created with `status: 'queued'` (line 1044 in EnhancedDownloadQueue.ts) but the download service expects `status: 'pending'` for processing
2. **Existing Fix Insufficient**: There's already a partial fix at lines 140-144 that resets `'queued'` → `'pending'` on startup, but the root cause (line 1044) continues creating items with wrong status
3. **Progress Calculation Bug**: Split parts incorrectly calculate total pages and progress reporting
4. **Library-Specific Handling**: Special processing (Bordeaux tiles, Morgan .zif, E-manuscripta blocks) not properly accounted for in splitting logic

### Current Implementation Issues
- **Root Cause**: `EnhancedDownloadQueue.checkStandaloneItemForSplitting()` sets `status: 'queued'` (line 1044)
- **Processing Logic**: All queue processing methods look for `status === 'pending'` (lines 256, 301, 612, 1550, 1592)
- **Bandaid Fix**: Lines 140-144 reset stuck items on startup, but doesn't prevent new ones
- **Size Calculation**: `estimatedSizeMB` is duplicated to all parts but should be recalculated per part
- **Progress Reporting**: `totalPages` duplicated across parts causes incorrect progress calculations

### Specific Code Locations
```typescript
// 🔴 PROBLEM: Creates split items with wrong status
// File: EnhancedDownloadQueue.ts:1044
status: 'queued',  // ❌ Should be 'pending'

// ✅ PARTIAL FIX: Resets on startup but doesn't prevent creation
// File: EnhancedDownloadQueue.ts:140-144
if (item.status === 'queued') {
    item.status = 'pending';
}

// ✅ PROCESSING LOGIC: Expects 'pending' status
// File: EnhancedDownloadQueue.ts:612
if (item.status === 'pending') {
    return true;
}
```

## Implementation Complexity Analysis

### Solution Approach 1: Quick Status Fix (Low Complexity)
**Complexity**: ⭐⭐☆☆☆ (2/5)
- **Change Required**: Set `status: 'pending'` instead of `'queued'` in splitting logic
- **Files Modified**: 1 (`EnhancedDownloadQueue.ts`)
- **Risk**: Low regression risk
- **Development Time**: 1-2 hours

### Solution Approach 2: Comprehensive Split Refactor (High Complexity)
**Complexity**: ⭐⭐⭐⭐⭐ (5/5)
- **Change Required**: Redesign split orchestration, progress calculation, library-specific handling
- **Files Modified**: 3-4 (Queue, Downloader Service, Progress Monitor)
- **Risk**: High regression risk
- **Development Time**: 8-16 hours

### Solution Approach 3: Queue-Level Processing Fix (Medium Complexity)
**Complexity**: ⭐⭐⭐☆☆ (3/5)
- **Change Required**: Add split-aware processing logic to queue manager
- **Files Modified**: 2 (`EnhancedDownloadQueue.ts`, download orchestration)
- **Risk**: Medium regression risk
- **Development Time**: 4-6 hours

## Risk Matrix by Library Type

| Library | Splitting Risk | Special Handling | Risk Level | Notes |
|---------|----------------|------------------|------------|-------|
| **Bordeaux** | 🔴 HIGH | Tile processing required | CRITICAL | DirectTileProcessor integration complex |
| **Morgan** | 🟡 MEDIUM | .zif files | HIGH | ZifImageProcessor handling |
| **E-manuscripta** | 🟡 MEDIUM | Block discovery | MEDIUM | Dynamic page discovery |
| **Standard IIIF** | 🟢 LOW | Simple downloads | LOW | Basic image downloads |
| **Gallica/BNF** | 🟢 LOW | Standard handling | LOW | Well-tested patterns |
| **Vatican** | 🟡 MEDIUM | Authentication | MEDIUM | Auth state management |
| **Graz** | 🟡 MEDIUM | Timeout issues | MEDIUM | Existing timeout fixes |

### High-Risk Components
1. **Tile Processing Libraries** (Bordeaux, some Florence)
   - Risk: Tile assembly fails across parts
   - Impact: Broken/incomplete images
   
2. **Authentication Libraries** (Vatican, some restricted)
   - Risk: Auth state lost between parts
   - Impact: Download failures mid-process

3. **Dynamic Discovery Libraries** (E-manuscripta)
   - Risk: Page count miscalculated during split
   - Impact: Missing pages or incorrect parts

## Test Coverage Requirements

### Critical Test Cases
1. **Basic Split Functionality**
   ```javascript
   // Must verify manuscript >300MB gets split correctly
   // Must verify each part has correct page ranges
   // Must verify all parts complete successfully
   ```

2. **Library-Specific Tests**
   ```javascript
   // Bordeaux: Tile processing across splits
   // Morgan: .zif handling in parts
   // E-manuscripta: Block discovery per part
   ```

3. **Progress Reporting**
   ```javascript
   // Must verify progress accumulates correctly across parts
   // Must verify ETA calculations are accurate
   // Must verify no duplicate progress reports
   ```

4. **Error Handling**
   ```javascript
   // Must verify failed part doesn't break others
   // Must verify retry logic works for individual parts
   // Must verify cleanup on cancellation
   ```

### Regression Prevention
- **Full Library Smoke Test**: 1 document from each of 42 libraries
- **Size Variation Test**: 50MB, 200MB, 500MB, 1GB documents
- **Concurrent Test**: Multiple splits running simultaneously
- **Error Recovery Test**: Network failures during splits

## Proposed Implementation Path (SAFE)

### Phase 1: Quick Fix (Immediate Relief)
**Goal**: Get split manuscripts processing again
**Time**: 30 minutes
**Files**: `EnhancedDownloadQueue.ts`

1. **Root Cause Fix** (All 3 locations):
   ```typescript
   // File: EnhancedDownloadQueue.ts
   
   // Line 1044: checkStandaloneItemForSplitting()
   status: 'queued',  // ❌
   status: 'pending', // ✅
   
   // Line 1085: mergePartsBackToSingle()
   status: 'queued',  // ❌
   status: 'pending', // ✅
   
   // Line 1129: recreatePartsWithNewSizes()
   status: 'queued',  // ❌
   status: 'pending', // ✅
   ```

2. **Remove Redundant Startup Fix**:
   ```typescript
   // Lines 140-144: Can now be removed since root cause is fixed
   // This bandaid fix will no longer be needed
   ```

2. **Immediate Testing Protocol**:
   ```bash
   # Test URLs that will trigger splitting
   Test 1: Bordeaux (>300MB) - Requires tile processing
   Test 2: Standard IIIF (>300MB) - Basic image downloads
   Test 3: Morgan (>300MB) - .zif file handling
   
   # Verification checklist
   ✅ Split items appear with "pending" status (not "queued")
   ✅ Parts begin downloading immediately
   ✅ Progress reporting shows individual part progress
   ✅ All parts complete successfully
   ✅ No stuck items in queue after splitting
   ```

### Phase 2: Progress Calculation Fix (Medium Priority)
**Goal**: Fix progress reporting accuracy
**Time**: 4 hours
**Files**: `EnhancedDownloadQueue.ts`, `IntelligentProgressMonitor.ts`

1. **Size Estimation Per Part**:
   ```typescript
   // Recalculate estimatedSizeMB for each part
   estimatedSizeMB: (item.estimatedSizeMB * (endPage - startPage + 1)) / item.totalPages
   ```

2. **Progress Aggregation**:
   - Track completed parts vs total parts
   - Calculate weighted progress based on page counts
   - Fix ETA calculations

### Phase 3: Library-Specific Validation (Long-term)
**Goal**: Ensure all special cases work with splitting
**Time**: 8 hours
**Files**: Multiple service files

1. **Tile Processing Integration**:
   ```typescript
   // Ensure Bordeaux tile configs work across parts
   // Verify DirectTileProcessor handles partial downloads
   ```

2. **Authentication Preservation**:
   ```typescript
   // Ensure Vatican auth tokens work across parts
   // Verify session management for long downloads
   ```

## Alternative Solutions

### Option A: Queue-Level Fix (Recommended)
**Pros**: 
- Minimal changes to download service
- Safer for existing functionality
- Clear separation of concerns

**Cons**: 
- Still requires progress calculation fixes
- Doesn't address library-specific issues

### Option B: Separate Split Download Method
**Pros**: 
- Complete isolation from existing logic
- Can be designed specifically for splits
- Easier testing and validation

**Cons**: 
- Code duplication
- Maintenance overhead
- Longer implementation time

### Option C: Manifest-Level Splitting
**Pros**: 
- Splits happen before download orchestration
- Clean separation of concerns
- Library-agnostic approach

**Cons**: 
- Major architectural change
- Complex manifest reconstruction
- High risk of breaking existing functionality

## Rollback Strategy

### Immediate Rollback Triggers
1. **Split Downloads Fail**: >20% failure rate in testing
2. **Regular Downloads Break**: Any regression in non-split downloads
3. **Library-Specific Issues**: Special handling breaks for any major library
4. **Performance Degradation**: >50% slowdown in processing

### Rollback Process
1. **Revert Code Changes**: Git revert to last working commit
2. **Reset Queue State**: Clear any corrupted split items from storage
3. **Restart Application**: Ensure clean state
4. **Notify Users**: Clear communication about temporary workaround

### Safe Rollback Implementation
```typescript
// Add feature flag for new splitting logic
if (configService.get('useLegacySplitting')) {
    return legacySplittingLogic();
}
return newSplittingLogic();
```

## Final Recommendation

### Recommended Approach: Quick Fix + Incremental Improvement

**Phase 1 (IMMEDIATE - 2 hours)**:
- Fix status issue: `'queued'` → `'pending'`
- Basic testing with 3-5 libraries
- Deploy as hotfix v1.4.107

**Phase 2 (THIS WEEK - 4 hours)**:
- Fix progress calculation
- Add better error handling
- Comprehensive testing suite
- Deploy as v1.4.108

**Phase 3 (NEXT WEEK - 8 hours)**:
- Library-specific validations
- Performance optimizations
- Complete regression testing
- Deploy as v1.4.109

### Why This Approach?
1. **Immediate Relief**: Users get working splits in 2 hours
2. **Low Risk**: Each phase builds on the previous safely
3. **Testable**: Each phase can be validated independently
4. **Rollback Friendly**: Each phase can be reverted independently

### Success Metrics
- **Phase 1**: Split manuscripts start downloading (no stuck "queued" status)
- **Phase 2**: Progress reporting accurate, ETAs reasonable
- **Phase 3**: All 42 libraries work correctly with splits, no regressions

### Long-term Architecture Improvement
Consider implementing a "Split Job Manager" in v1.5.x:
- Dedicated service for managing split downloads
- Proper queue orchestration for parts
- Library-agnostic splitting logic
- Advanced progress aggregation
- Better error recovery and retry logic

This would provide a solid foundation for future enhancements while maintaining backward compatibility.

---

## Technical Summary & Actionable Fix

### The Bug in Simple Terms
When manuscripts >300MB are auto-split into parts, each part is created with `status: 'queued'` but the download processor only looks for `status: 'pending'` items. This causes split parts to sit indefinitely in the queue without processing.

### The 30-Minute Fix
**File**: `/src/main/services/EnhancedDownloadQueue.ts`
**Changes**: Replace `'queued'` with `'pending'` at 3 locations (lines 1044, 1085, 1129)
**Risk**: Minimal - only affects status assignment, no logic changes
**Testing**: Verify split manuscripts start downloading immediately

### Why This Fix Is Safe
1. **Surgical Change**: Only status values, no algorithm modifications
2. **Existing Pattern**: All other queue items use `'pending'` status
3. **Backward Compatible**: Doesn't affect existing non-split downloads
4. **Quick Rollback**: Single-line changes easily reverted
5. **No Dependencies**: Fix contained within one service file

### Post-Fix Verification
```typescript
// After fix, verify these conditions:
const splitItems = queue.items.filter(item => item.isAutoPart);
const allPending = splitItems.every(item => item.status === 'pending');
const noStuckItems = !queue.items.some(item => 
  item.isAutoPart && item.status === 'queued'
);
```

This comprehensive analysis provides the complete technical context, risk assessment, and actionable implementation strategy for resolving the manuscript splitting bug.