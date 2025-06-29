# NYPL Digital Collections Analysis Report

## Issue Summary
**URL**: https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002
**Problem**: MSS Downloader only detects 15 pages instead of the full 304 pages
**Manuscript**: Landeve'nnec Gospels; Harkness Gospels (865-899 CE)

## Root Cause Analysis

### Current Implementation Problem
The current NYPL implementation in MSS Downloader:
1. ✅ Correctly extracts carousel data from the page
2. ❌ **LIMITATION**: Only uses carousel data which is limited to 15 visible thumbnails
3. ❌ **MISSING**: Ignores the comprehensive API endpoint that contains all 304 pages

### Key Findings

#### 1. Page Count Discrepancy
- **Carousel data**: 15 items (display limitation)
- **Actual total**: 304 pages (confirmed via `data-total="304"` attribute)
- **Missing pages**: 289 pages (95% of the manuscript!)

#### 2. API Endpoint Discovery
**SOLUTION FOUND**: NYPL provides a comprehensive captures API
```
Endpoint: /items/{parent-uuid}/captures
Full URL: https://digitalcollections.nypl.org/items/4c9aa5f0-f589-013a-4185-0242ac110003/captures?per_page=500
Response: Complete JSON with all 304 pages and their image IDs
```

#### 3. UUID Mapping
- **Current item UUID**: `6a709e10-1cda-013b-b83f-0242ac110002` (single page)
- **Parent collection UUID**: `4c9aa5f0-f589-013a-4185-0242ac110003` (full manuscript)
- **Relationship**: Individual pages belong to parent collection

## Technical Solution

### API Response Structure
```json
{
  "response": {
    "total": 304,
    "page": 1,
    "per_page": 500,
    "captures": [
      {
        "id": "69965700-1cda-013b-d3ee-0242ac110002",
        "image_id": "58513755",
        "title": "Landeve'nnec Gospels; Harkness Gospels",
        "url": "/items/69965700-1cda-013b-d3ee-0242ac110002"
      }
      // ... 303 more items
    ]
  }
}
```

### Image URL Construction
**High Resolution Format**: `https://images.nypl.org/index.php?id={image_id}&t=g`
**TIF Format**: `https://iiif-prod.nypl.org/index.php?id={image_id}&t=u`

### Implementation Strategy

#### Method 1: Extract Parent UUID from Page
1. Parse the page HTML for `data-fetch-url="/items/{parent-uuid}/captures"`
2. Use parent UUID to call captures API
3. Extract all image IDs from the response
4. Construct high-resolution image URLs

#### Method 2: Extract Parent UUID from Data Attributes
1. Look for `data-total` attributes indicating more than carousel count
2. Find parent UUID in `data-fetch-url` patterns
3. Call captures API with `per_page=500` to get all items

## Recommended Implementation

### Code Changes Needed

1. **Enhance NYPL manifest loader** to:
   - Extract parent UUID from page data
   - Call captures API endpoint
   - Parse complete image list instead of just carousel data

2. **Add fallback logic**:
   - If captures API fails, fall back to current carousel method
   - Handle cases where manuscripts might genuinely have ≤15 pages

3. **Validation**:
   - Compare `data-total` with carousel count
   - Only use API if `data-total` > carousel count

## Testing Results

### Proof of Concept
- ✅ Successfully retrieved all 304 pages via API
- ✅ Confirmed image URLs are accessible
- ✅ Validated image IDs range from 58513755 to 58514655
- ✅ All images use consistent URL pattern

### Link.nypl.org Analysis
The provided alternative URL `https://link.nypl.org/wCEg3ObCQUKAUVAxkiqf9QE`:
- Redirects to: `https://iiif-prod.nypl.org/index.php?id=58514364&t=u`
- Provides TIF format (`&t=u`) instead of standard format (`&t=g`)
- **Not a comprehensive solution** - only provides single page access

## Impact Assessment

### Current vs Fixed Implementation
- **Current**: 15 pages (5% of manuscript)
- **Fixed**: 304 pages (100% of manuscript)
- **Improvement**: 289 additional pages recovered (1927% increase!)

### User Impact
- **Critical**: Users downloading NYPL manuscripts get incomplete documents
- **Severity**: High - 95% of content is missing
- **Priority**: Urgent fix needed

## Recommendations

1. **Immediate Fix**: Implement captures API solution for NYPL
2. **Testing**: Verify fix with the provided test URL
3. **Documentation**: Update NYPL handling in code comments
4. **Quality Assurance**: Test with other NYPL manuscripts to ensure solution works universally

## Files for Implementation
- Primary: `/src/main/services/EnhancedManuscriptDownloaderService.ts`
- Method: `loadNyplManifest()`
- Change: Replace carousel parsing with captures API call