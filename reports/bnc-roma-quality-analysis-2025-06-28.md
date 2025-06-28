# BNC Roma Image Quality Analysis Report

**Date:** 2025-06-28  
**URL Analyzed:** http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1  
**Issue:** Only downloading low quality images instead of highest available resolution

## Executive Summary

The BNC Roma digital library provides multiple image resolution endpoints, but the MSS Downloader is currently using a non-optimal resolution endpoint (`/max`) that either doesn't exist or returns HTML instead of images. The analysis revealed that the `/original` endpoint provides the highest quality images at approximately 3x the file size of the current implementation.

## Current Implementation Analysis

The MSS Downloader currently uses this priority order for BNC Roma:
1. `/max` (primary choice) - **PROBLEMATIC**
2. `/full` (fallback)
3. `/high` (fallback)

## Discovered Image Quality Endpoints

| Endpoint | Status | Content-Type | File Size (bytes) | Quality Level |
|----------|--------|--------------|-------------------|---------------|
| `/original` | ✅ 200 OK | `image/jpeg` | 606,748 | **HIGHEST** |
| `/full` | ✅ 200 OK | `image/jpeg` | 214,596 | High |
| `/med` | ✅ 200 OK | `image/jpeg` | 103,419 | Medium |
| `/thumb` | ✅ 200 OK | `image/jpeg` | 13,857 | Low |
| `/max` | ❌ 200 OK | `text/html` | Empty response | **BROKEN** |
| `/high` | ❌ 200 OK | `text/html` | Empty response | **BROKEN** |
| `/large` | ❌ 200 OK | `text/html` | Empty response | **BROKEN** |

## Quality Comparison

- **Current (broken):** `/max` endpoint returns HTML, likely falling back to `/full`
- **Optimal:** `/original` endpoint provides 606KB images vs 214KB (`/full`)
- **Improvement:** 2.83x larger file size = significantly higher resolution

## Technical Details

### Working URL Pattern
```
http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/{MANUSCRIPT_ID}/{MANUSCRIPT_ID}/{PAGE_NUMBER}/original
```

### Example URLs for Testing
- **Highest Quality:** `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1/original`
- **Current Fallback:** `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1/full`

### Viewer Implementation
BNC Roma uses OpenSeadragon viewer accessible at:
```
http://digitale.bnc.roma.sbn.it/tecadigitale/visore/#/main/viewer?idMetadato=21267320&type=bncr
```

## Code Fix Required

**File:** `/src/main/services/EnhancedManuscriptDownloaderService.ts`  
**Function:** `loadRomeManifest()`

**Current problematic logic:**
```typescript
// Current implementation tries /max first, which returns HTML
imageUrlTemplate = `.../${manuscriptId}/PAGENUM/max`;
```

**Recommended fix:**
```typescript
// Priority order should be: original > full > med
const resolutionPriority = ['original', 'full', 'med'];
```

## Impact Assessment

- **Current Quality:** Low-to-medium resolution (214KB per page)
- **Optimal Quality:** High resolution (606KB per page) 
- **Download Time:** Minimal impact for most users
- **PDF Quality:** Significant improvement in final PDF clarity
- **Storage:** ~3x larger files (acceptable for manuscript preservation)

## Recommended Actions

1. **Immediate Fix:** Update BNC Roma implementation to use `/original` endpoint first
2. **Fallback Chain:** `original` → `full` → `med` → `thumb`
3. **Testing:** Verify with multiple manuscripts from BNC Roma
4. **Documentation:** Update supported libraries documentation

## Test Cases to Verify Fix

1. Download BNCR_Ms_SESS_0062 (175 pages) with new implementation
2. Compare file sizes: should see ~3x increase
3. Verify PDF quality improvement
4. Test with different manuscript IDs
5. Ensure fallback works for any missing `/original` endpoints

## Additional Notes

- BNC Roma provides consistent URL patterns across manuscripts
- No authentication required for public manuscripts
- Server supports CORS headers properly
- All endpoints tested return proper image/jpeg content-type (except broken ones)

## Conclusion

The quality issue is definitively caused by using the non-functional `/max` endpoint. Switching to `/original` as the primary choice will provide users with the highest available image quality for BNC Roma manuscripts, representing a significant improvement in download quality.