# BDL URL Sampling Failure Analysis

## CRITICAL FINDINGS

**Root Cause Identified:** BDL server inconsistency causing page sampling failures

### 1. URL Generation - WORKING ✅

The BdlLoader is generating **correct IIIF URLs**:
- API endpoint: `https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages`
- Generated URLs: `https://www.bdl.servizirl.it/cantaloupe/iiif/2/{idMediaServer}/full/1024,/0/default.jpg`
- Example working URL: `https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/1024,/0/default.jpg`

### 2. BDL Server Response Patterns - INCONSISTENT ❌

**Testing Results for manuscript 3903:**
- **Page 1** (ID: 1460756): HTTP 200 OK ✅ (1118 KB downloaded)
- **Page 2** (ID: 1460776): HTTP 200 OK ✅
- **Page 3** (ID: 1460836): TIMEOUT ❌
- **Page 153** (ID: 1460694): TIMEOUT ❌  
- **Page 304** (ID: 1460614): HTTP 403 Forbidden ❌

### 3. URL Structure Validation - CORRECT ✅

- **PDF URL rejection logic working**: Only rejects URLs like `/mediaserver-server-pdf/*.pdf`
- **IIIF URLs passing validation**: IIIF URLs are NOT rejected
- **Routing working**: BDL detection returns `'bdl'`, routing goes to BdlLoader

### 4. Core Problem: Page Sampling Method ❌

**Location:** `src/main/services/EnhancedDownloadQueue.ts` lines 1467, 1618-1697

**Current Flow:**
1. BdlLoader generates correct IIIF URLs → ✅ WORKING
2. Queue sampling calls `downloadSinglePage(url)` → ❌ FAILING
3. `downloadSinglePage` uses basic HTTP client → ❌ NO RETRY LOGIC
4. BDL server inconsistency causes 403/timeout → ❌ SAMPLING FAILS
5. All sampling attempts fail → ❌ "Failed to sample any pages"

### 5. Why UltraReliableBDLService Not Used ❌

**The sampling bypasses BDL-specific handling:**
- Page sampling uses generic `downloadSinglePage()` method
- UltraReliableBDLService is only used in `downloadImageWithRetries()` 
- Sampling happens BEFORE download queue processing
- Result: BDL gets no retry logic, proxy fallback, or reliability features

## SPECIFIC FIX REQUIRED

### Problem: Basic HTTP in Sampling
```typescript
// Current failing code in EnhancedDownloadQueue.ts:1467
const buffer = await this.downloadSinglePage(pageUrl);
```

### Solution: Use BDL-Specific Logic
```typescript
// Should use UltraReliableBDLService for BDL URLs
if (manifest.library === 'bdl' || pageUrl.includes('bdl.servizirl.it')) {
    const buffer = await UltraReliableBDLService.getInstance()
        .ultraReliableDownload(pageUrl, index, { 
            ultraReliableMode: true,
            maxRetries: 5  // Limited retries for sampling
        });
} else {
    const buffer = await this.downloadSinglePage(pageUrl);
}
```

## EVIDENCE

### BDL API Response (Working)
```json
{
  "idMediaServer": 1460756,
  "cantaloupeUrl": "https://www.bdl.servizirl.it/cantaloupe/",
  "mediaServerPdf": "https://www.bdl.servizirl.it/mediaserver-server-pdf/"
}
```

### Generated URLs (Correct Format)
- ✅ IIIF: `https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/1024,/0/default.jpg`
- ❌ PDF: `https://www.bdl.servizirl.it/mediaserver-server-pdf/1460896/MS_3903_001.pdf` (correctly rejected)

### HTTP Response Analysis
```bash
# Working page (1460756)
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/1024,/0/default.jpg"
HTTP/1.1 200 OK
Content-Type: image/jpeg

# Failing page (1460614) 
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460614/full/1024,/0/default.jpg"
HTTP/1.1 403 Forbidden
```

## IMPACT ASSESSMENT

**Current State:**
- BDL manuscripts fail page sampling 100% of the time
- Users get fallback size estimation (0.8 MB/page) instead of accurate sampling
- Auto-split may not work correctly for large BDL manuscripts
- Download failures likely during actual download phase too

**After Fix:**
- BDL page sampling will use retry logic and proxy fallback
- Accurate size estimation for auto-splitting
- Improved reliability for large BDL manuscripts
- Better user experience with proper error handling

## RECOMMENDATION

**IMMEDIATE FIX:** Update `EnhancedDownloadQueue.ts` sampling logic to use UltraReliableBDLService for BDL URLs.

**VALIDATION:** Test with manuscript 3903 to confirm sampling succeeds with retry logic.

**VERIFICATION:** Check that auto-splitting works correctly with accurate BDL size estimates.