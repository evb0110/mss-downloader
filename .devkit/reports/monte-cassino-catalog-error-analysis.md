# Monte-Cassino Catalog ID Error Analysis

## Problem Summary

**Error**: `Unknown Monte-Cassino catalog ID: 0000313194. Please provide direct IIIF manifest URL.`
**Failing URL**: `https://manus.iccu.sbn.it/cnmd/0000313194`
**Library**: Monte-Cassino Abbey Library (OMNES platform)

## Current Implementation Analysis

### 1. Monte-Cassino URL Handling Logic

The current implementation in `EnhancedManuscriptDownloaderService.ts` has a hard-coded mapping system:

```typescript
// Current logic (lines 5727-5731)
const catalogId = catalogMatch[1];
if (catalogId === '0000313047') {
    manuscriptId = 'IT-FR0084_0339';
} else {
    throw new Error(`Unknown Monte-Cassino catalog ID: ${catalogId}. Please provide direct IIIF manifest URL.`);
}
```

### 2. Known Working Mappings

Currently, only **one** catalog ID mapping is implemented:

| ICCU Catalog ID | IIIF Manifest ID | Status |
|----------------|------------------|---------|
| 0000313047     | IT-FR0084_0339   | ✅ Working |
| **0000313194** | **Unknown**      | ❌ **FAILING** |
| 0000396781     | Unknown          | ❌ Failing |

### 3. Available IIIF Manuscripts

From OMNES platform analysis, available manuscript IDs are:
- IT-FR0084_0001 through IT-FR0084_0012
- IT-FR0084_0023 (mentioned in tests)
- IT-FR0084_0271 (mentioned in tests)
- IT-FR0084_0339 (working mapping)

## Root Cause Analysis

### 1. **Incomplete Catalog Mapping Table**
- The implementation only includes 1 of 3+ catalog IDs mentioned in tests
- No systematic approach to discover catalog-to-IIIF mappings
- Hard-coded single mapping instead of comprehensive lookup system

### 2. **Missing Catalog Discovery Logic**
- No automated way to discover new catalog IDs
- No fallback mechanism to attempt pattern matching
- Current error message is user-facing but doesn't help with implementation

### 3. **ICCU URL Redirect Issues**
- URL `https://manus.iccu.sbn.it/cnmd/0000313194` returns 302 redirect
- Redirects to generic search page, not specific manuscript
- No automated extraction of IIIF manifest URLs from ICCU pages

## Investigation Results

### 1. ICCU Catalog URL Analysis
```bash
curl -sL "https://manus.iccu.sbn.it/cnmd/0000313194"
# Returns: Generic search results page, not specific manuscript
# Issue: This catalog ID may not exist or may be inactive
```

### 2. OMNES Platform Discovery
Available manuscripts on OMNES platform:
- **IT-FR0084_0001** - ✅ Available
- **IT-FR0084_0002** - ✅ Available  
- **IT-FR0084_0003** - ✅ Available
- **IT-FR0084_0006** through **IT-FR0084_0012** - ✅ Available
- **IT-FR0084_0271** - ✅ Available (mentioned in tests)
- **IT-FR0084_0339** - ✅ Available (current working mapping)

### 3. Test File Evidence
The test file `monte-cassino.spec.ts` lists these URLs as expected to work:
```typescript
// Lines 5-15
const MONTE_CASSINO_URLS = [
    'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0339/manifest',
    'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest', 
    'https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0023/manifest',
    'https://manus.iccu.sbn.it/cnmd/0000313047',  // ✅ Working
    'https://manus.iccu.sbn.it/cnmd/0000396781',  // ❌ Missing mapping
    'https://manus.iccu.sbn.it/cnmd/0000313194'   // ❌ Missing mapping (FAILING)
];
```

## Proposed Solutions

### 1. **Immediate Fix: Expand Catalog Mapping Table**

Add missing catalog ID mappings based on available IIIF manuscripts:

```typescript
// Enhanced mapping logic
const catalogIdMap: Record<string, string> = {
    '0000313047': 'IT-FR0084_0339', // Existing working mapping
    '0000313194': 'IT-FR0084_0271', // Proposed mapping (needs verification)
    '0000396781': 'IT-FR0084_0023', // Proposed mapping (needs verification)
};

const catalogId = catalogMatch[1];
const manuscriptId = catalogIdMap[catalogId];
if (manuscriptId) {
    // Use mapped manuscript ID
} else {
    throw new Error(`Unknown Monte-Cassino catalog ID: ${catalogId}. Please provide direct IIIF manifest URL.`);
}
```

### 2. **Enhanced Solution: Pattern Discovery Logic**

Implement fallback logic to attempt pattern matching:

```typescript
// Fallback: Try sequential IIIF IDs
const possibleIds = [
    'IT-FR0084_0271', 'IT-FR0084_0023', 'IT-FR0084_0001', 
    'IT-FR0084_0002', 'IT-FR0084_0003', 'IT-FR0084_0006'
    // ... other available IDs
];

for (const testId of possibleIds) {
    const testUrl = `https://omnes.dbseret.com/montecassino/iiif/${testId}/manifest`;
    try {
        const response = await this.fetchDirect(testUrl);
        if (response.ok) {
            manuscriptId = testId;
            break;
        }
    } catch (error) {
        continue;
    }
}
```

### 3. **Comprehensive Solution: ICCU Page Scraping**

Implement automated extraction from ICCU pages:

```typescript
// Extract IIIF URLs from ICCU viewer pages
async extractIIIFFromICCU(catalogUrl: string): Promise<string | null> {
    try {
        const response = await this.fetchDirect(catalogUrl);
        const html = await response.text();
        
        // Look for OMNES IIIF URLs in page content
        const iiifMatch = html.match(/omnes\.dbseret\.com\/montecassino\/iiif\/([^\/]+)/);
        if (iiifMatch) {
            return iiifMatch[1]; // Return manuscript ID
        }
        
        return null;
    } catch (error) {
        return null;
    }
}
```

## Recommended Implementation Strategy

### Phase 1: Quick Fix (Immediate)
1. **Verify manuscript mappings** by testing available IIIF IDs
2. **Add expanded mapping table** with verified catalog-to-IIIF mappings
3. **Test all URLs** from `monte-cassino.spec.ts` to ensure they work
4. **Update error message** to be more helpful for unmapped catalog IDs

### Phase 2: Enhanced Logic (Medium-term)
1. **Implement pattern discovery** as fallback for unmapped catalog IDs
2. **Add caching** for discovered mappings to improve performance
3. **Enhanced error handling** with specific guidance for each failure type

### Phase 3: Automated Discovery (Long-term)
1. **ICCU page scraping** to automatically extract IIIF URLs
2. **Periodic catalog discovery** to find new manuscripts
3. **Dynamic mapping table updates** based on discoveries

## Code Changes Required

### File: `src/main/services/EnhancedManuscriptDownloaderService.ts`

**Lines 5727-5731**: Replace single mapping with comprehensive table:

```typescript
// Replace this block:
const catalogId = catalogMatch[1];
if (catalogId === '0000313047') {
    manuscriptId = 'IT-FR0084_0339';
} else {
    throw new Error(`Unknown Monte-Cassino catalog ID: ${catalogId}. Please provide direct IIIF manifest URL.`);
}

// With this enhanced logic:
const catalogIdMap: Record<string, string> = {
    '0000313047': 'IT-FR0084_0339',
    '0000313194': 'IT-FR0084_0271', // To be verified
    '0000396781': 'IT-FR0084_0023', // To be verified
};

const catalogId = catalogMatch[1];
const manuscriptId = catalogIdMap[catalogId];
if (!manuscriptId) {
    throw new Error(`Unknown Monte-Cassino catalog ID: ${catalogId}. Available IDs: ${Object.keys(catalogIdMap).join(', ')}. Please provide direct IIIF manifest URL.`);
}
```

## Validation Plan

### 1. Test Proposed Mappings
```bash
# Test each proposed mapping
curl -s "https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0271/manifest" | jq .
curl -s "https://omnes.dbseret.com/montecassino/iiif/IT-FR0084_0023/manifest" | jq .
```

### 2. Verify Catalog Relationship
- Research if there's a systematic relationship between catalog IDs and IIIF IDs
- Check if ICCU provides any API or structured data for mappings

### 3. Test All URLs
- Run complete test suite with all Monte-Cassino URLs
- Verify PDF generation works for each mapped manuscript
- Ensure error handling works for truly invalid catalog IDs

## Priority Assessment

**Severity**: HIGH - Blocks valid manuscript downloads  
**Complexity**: MEDIUM - Requires mapping discovery and verification  
**Impact**: HIGH - Affects 2 of 3 test URLs (67% failure rate)  
**Urgency**: HIGH - Basic functionality is broken for most catalog URLs

## Success Criteria

1. ✅ URL `https://manus.iccu.sbn.it/cnmd/0000313194` successfully loads manifest
2. ✅ URL `https://manus.iccu.sbn.it/cnmd/0000396781` successfully loads manifest  
3. ✅ All URLs in `monte-cassino.spec.ts` pass validation
4. ✅ Generated PDFs contain actual manuscript content
5. ✅ Error messages provide actionable guidance for unmapped IDs

## Next Steps

1. **Verify mappings** by testing proposed IIIF manuscript IDs
2. **Implement expanded mapping table** with verified mappings
3. **Update tests** to ensure all Monte-Cassino URLs work correctly
4. **Deploy fix** and validate with real manuscript downloads
5. **Monitor** for additional catalog IDs that may need mapping

This analysis provides a clear path to resolve the Monte-Cassino catalog ID error and establish a robust system for handling future catalog-to-IIIF mappings.