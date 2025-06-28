# Europeana Pagination Fix - 2025-06-28

## Issue Summary

Europeana manuscripts appeared to only have 1 page when they actually contained hundreds of pages. The specific example was:
- **URL**: https://www.europeana.eu/en/item/446/CNMD_0000171876
- **Expected**: 452 pages (full Psalterium manuscript)
- **Actual**: Only 1 page detected

## Root Cause Analysis

The issue was **NOT** with pagination logic but with **data source detection**. Europeana acts as an aggregator/portal that references external IIIF services:

1. **Europeana's own IIIF manifest**: Only contained 1 preview page
   - URL: `https://iiif.europeana.eu/presentation/446/CNMD_0000171876/manifest`
   - Pages: 1 (preview only)

2. **External IIIF manifest**: Contained the full manuscript
   - URL: `https://www.internetculturale.it/iiif/2.1/Q05NRFxcMDAwMDE3MTg3Ng__/manifest.json`
   - Pages: 452 (complete manuscript)

## Solution Implementation

### Before Fix
The original implementation only used Europeana's own limited IIIF manifest:

```typescript
// OLD: Only checked Europeana's own IIIF
const manifestUrl = `https://iiif.europeana.eu/presentation/${collectionId}/${recordId}/manifest`;
```

### After Fix
The new implementation:

1. **Uses Europeana Record API** to find external IIIF manifests
2. **Follows references** to external services like internetculturale.it
3. **Falls back gracefully** to Europeana's own IIIF if no external manifest found

```typescript
// NEW: Check Record API for external IIIF manifests
const recordApiUrl = `https://api.europeana.eu/record/${collectionId}/${recordId}.json?wskey=api2demo`;

// Look for dctermsIsReferencedBy containing external IIIF manifest URLs
if (resource.dctermsIsReferencedBy && Array.isArray(resource.dctermsIsReferencedBy)) {
    for (const manifestUrl of resource.dctermsIsReferencedBy) {
        if (manifestUrl.includes('manifest.json') || manifestUrl.includes('/manifest')) {
            // Load external IIIF manifest with 452 pages
            return await this.loadGenericIIIFManifest(manifestUrl, europeanaUrl, title);
        }
    }
}
```

## Key Technical Changes

### 1. Enhanced `loadEuropeanaManifest` Method
- Added Europeana Record API call
- Added logic to extract external IIIF manifest URLs from `dctermsIsReferencedBy` fields
- Maintained backward compatibility with fallback to Europeana's own IIIF

### 2. New `loadGenericIIIFManifest` Method
- Handles external IIIF manifests from any provider
- Supports both IIIF 2.0 and 3.0 formats
- Extracts high-resolution image URLs using IIIF Image API

### 3. Data Flow
```
User URL → Europeana Record API → External IIIF Manifest → 452 Pages
    ↓ (fallback if external not found)
Europeana's own IIIF Manifest → 1 Page (preview)
```

## Verification

### Before Fix
```bash
curl -s "https://iiif.europeana.eu/presentation/446/CNMD_0000171876/manifest" | jq '.sequences[0].canvases | length'
# Result: 1
```

### After Fix
```bash
# Record API reveals external manifest
curl -s "https://api.europeana.eu/record/446/CNMD_0000171876.json?wskey=api2demo" | jq '.object.aggregations[0].webResources[] | select(.dctermsIsReferencedBy) | .dctermsIsReferencedBy[]'
# Result: "https://www.internetculturale.it/iiif/2.1/Q05NRFxcMDAwMDE3MTg3Ng__/manifest.json"

# External manifest has full content
curl -s "https://www.internetculturale.it/iiif/2.1/Q05NRFxcMDAwMDE3MTg3Ng__/manifest.json" | jq '.sequences[0].canvases | length'
# Result: 452
```

## Impact

- **Fixed**: Europeana manuscripts now download complete content instead of single preview page
- **Maintained**: Backward compatibility with existing Europeana manuscripts
- **Enhanced**: Support for external IIIF services referenced by Europeana
- **Performance**: Graceful fallback ensures robust operation

## Testing

The fix handles three scenarios:

1. **Europeana with external IIIF**: Uses external manifest (452 pages)
2. **Europeana without external IIIF**: Falls back to Europeana's own manifest
3. **API failures**: Graceful degradation to original behavior

## Files Modified

- `src/main/services/EnhancedManuscriptDownloaderService.ts`:
  - Enhanced `loadEuropeanaManifest()` method
  - Added `loadGenericIIIFManifest()` method
  - Fixed lint error in regex pattern

## Commit Message

```
Fix Europeana manuscript pagination: detect external IIIF manifests

Europeana acts as aggregator pointing to external IIIF services. Original 
implementation only used Europeana's limited manifest (1 page), missing 
external manifests with full content (452 pages for test case).

- Use Europeana Record API to find external IIIF manifest URLs
- Add loadGenericIIIFManifest() for external IIIF services  
- Maintain fallback to Europeana's own IIIF for compatibility
- Support both IIIF 2.0 and 3.0 formats

Fixes: https://www.europeana.eu/en/item/446/CNMD_0000171876
Result: 452 pages instead of 1 page
```