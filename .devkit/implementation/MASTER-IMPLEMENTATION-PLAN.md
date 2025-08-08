# Master Implementation Plan: Fix Manuscript Splitting Bug

## Critical Bug Summary
**Issue:** When manuscripts are split into parts, ALL parts download the same pages (1-N) instead of their designated ranges.
**Impact:** Users receive duplicate content, losing time and bandwidth.
**Severity:** CRITICAL - Data integrity issue affecting all libraries.

## Implementation Phases

### Phase 1: Core Fix (2 hours)
**Objective:** Modify EnhancedManuscriptDownloaderService to accept pre-sliced pageLinks

**Files to Modify:**
- `src/main/services/EnhancedManuscriptDownloaderService.ts`
  - Line 4264-4272: Add pageLinks parameter
  - Line 4282: Conditional manifest loading
  - Line 4321-4323: Fix page range calculation
  - Line 4423-4434: Fix page indexing

**Key Changes:**
```typescript
// Accept pre-sliced pageLinks
if (pageLinks && Array.isArray(pageLinks)) {
    manifest = buildManifestFromPageLinks(pageLinks, metadata);
} else {
    manifest = await this.loadManifest(url);
}
```

### Phase 2: Special Processors (1 hour)
**Objective:** Ensure Bordeaux, Morgan, E-manuscripta continue working

**Critical Validations:**
- Bordeaux: Preserve tileConfig for DirectTileProcessor
- Morgan: Maintain .zif URL handling
- E-manuscripta: Keep block discovery intact

**Implementation:**
```typescript
// Preserve special metadata
manifest.requiresTileProcessor = queueItem?.requiresTileProcessor;
manifest.tileConfig = queueItem?.tileConfig;
manifest.pageBlocks = queueItem?.pageBlocks;
```

### Phase 3: Queue Integration (2 hours)
**Objective:** Pass pre-sliced pageLinks from queue to downloader

**Files to Modify:**
- `src/main/services/EnhancedDownloadQueue.ts` (Line 795-807)
- `src/main/services/DownloadQueue.ts` (Line 559-599)

**Key Implementation:**
```typescript
if (item.isAutoPart) {
    const fullManifest = await this.loadManifest(item.url);
    const pageLinks = fullManifest.pageLinks.slice(startIdx, endIdx);
    // Pass sliced pageLinks to downloader
}
```

### Phase 4: Comprehensive Testing (2 hours)
**Objective:** Validate fix across all 42+ libraries

**Test Matrix:**
1. High-risk: Bordeaux, Morgan, E-manuscripta
2. Standard IIIF: Graz, Vatican, Gallica
3. Edge cases: Small manuscripts, exact threshold

**Success Criteria:**
- No duplicate pages across parts
- All pages accounted for
- Special processors working
- No performance regression

### Phase 5: Autonomous Bump (30 minutes)
**Objective:** Release fix to users immediately upon successful testing

**Process:**
1. Validate all tests passed
2. Update version and changelog
3. Commit with detailed message
4. Build and lint
5. Push to GitHub
6. Monitor deployment

## Execution Strategy

### Sequential Implementation Order
```
1. PHASE 1: Core Fix
   ↓ Test: Basic page slicing works
2. PHASE 2: Special Processors  
   ↓ Test: Bordeaux tiles work
3. PHASE 3: Queue Integration
   ↓ Test: End-to-end split works
4. PHASE 4: Comprehensive Testing
   ↓ Test: All libraries validated
5. PHASE 5: Autonomous Bump
   ↓ Release to users
```

### Risk Mitigation
1. **Feature Flag:** Add `USE_PRESLICED_PAGES` flag for gradual rollout
2. **Logging:** Extensive console.log for debugging
3. **Fallback:** Revert to manifest loading if pageLinks invalid
4. **Validation:** Check pageLinks array before use

### Critical Success Factors
1. **Backward Compatibility:** All existing downloads must work
2. **Page Accuracy:** Each part gets correct, unique pages
3. **Special Processing:** Bordeaux, Morgan must not break
4. **Performance:** No degradation in download speed

## Test Commands

### Quick Validation
```bash
node .devkit/testing/reproduce-split-bug.js
```

### Comprehensive Test
```bash
node .devkit/testing/comprehensive-test.js
```

### Build Verification
```bash
npm run lint && npm run build
```

## Rollback Plan
If issues detected:
```bash
git revert HEAD
git push origin main
# Fix issue
# Re-test
# Re-deploy
```

## Implementation Checklist

### Pre-Implementation
- [x] Root cause identified
- [x] Solution designed
- [x] Test cases prepared
- [x] Documentation complete

### Implementation
- [ ] Phase 1: Core fix applied
- [ ] Phase 2: Special processors handled
- [ ] Phase 3: Queue integration complete
- [ ] Phase 4: All tests passing
- [ ] Phase 5: Version bumped

### Post-Implementation
- [ ] GitHub Actions successful
- [ ] Telegram notification sent
- [ ] User confirmation received
- [ ] No regression reports

## Authority & Urgency
**Authorization:** Autonomous fix authorized due to:
- Critical data integrity issue
- Users losing days of download time
- Clear fix path identified
- Comprehensive testing planned

**Timeline:** Complete within 8 hours
- Development: 5 hours
- Testing: 2 hours  
- Deployment: 1 hour

## Success Metrics
- Zero duplicate page reports
- 100% of split manuscripts downloading correctly
- No regression in existing functionality
- User satisfaction restored

---
**Start Time:** [To be filled by implementing agent]
**Completion Target:** [Start + 8 hours]
**Agent Authorization:** Autonomous execution approved