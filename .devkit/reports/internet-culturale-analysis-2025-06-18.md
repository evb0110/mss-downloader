# Internet Culturale (ICCU) Technical Analysis Report

**Date:** June 18, 2025  
**Analyst:** Claude Code  
**Status:** NEW LIBRARY - REQUIRES IMPLEMENTATION  

## Executive Summary

Internet Culturale (www.internetculturale.it) is a major Italian digital cultural heritage platform that is **not currently supported** by the manuscript downloader. This platform serves manuscripts from multiple prestigious Italian institutions and represents a significant addition to European manuscript coverage.

**Implementation Priority:** HIGH - User provided 10 URLs indicating real demand for this library.

## URLs Analyzed

1. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf`
2. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI`
3. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_16.08&mode=all&teca=Laurenziana+-+FI`
4. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AMagliabechi%3ACFIE014205&mode=all&teca=Bncf`
5. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3APG0213_ms.693&mode=all&teca=MagTeca+-+ICCU`
6. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD0000208810&mode=all&teca=MagTeca+-+ICCU`
7. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD0000209347&mode=all&teca=MagTeca+-+ICCU`
8. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD0000208797&mode=all&teca=MagTeca+-+ICCU`
9. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3APG0213_ms.694&mode=all&teca=MagTeca+-+ICCU`
10. `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AMagliabechi%3ARLZE033442&mode=all&teca=Bncf`

## Technical Analysis

### URL Structure
**Pattern:** `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id={OAI_IDENTIFIER}&mode=all&teca={LIBRARY_NAME}`

**Parameters:**
- `id`: URL-encoded OAI (Open Archives Initiative) identifier
- `mode`: Always "all" for complete manuscript view
- `teca`: Institution/library identifier

### Institutions Identified
1. **Bncf** - Biblioteca Nazionale Centrale di Firenze (Florence)
2. **Laurenziana - FI** - Biblioteca Medicea Laurenziana (Florence) 
3. **MagTeca - ICCU** - Broader ICCU collections

### OAI Identifier Examples
- `oai:bncf.firenze.sbn.it:21:FI0098:ManoscrittiInRete:B.R.231`
- `oai:teca.bmlonline.it:21:XXXX:Plutei:IT%3AFI0100_Plutei_21.29`
- `oai:www.internetculturale.sbn.it/Teca:20:NT0000:PG0213_ms.693`

### Viewer Technology
- **Custom Viewer:** `centrica.ICCU.Viewer` (proprietary JavaScript)
- **NOT IIIF:** Does not use standard IIIF protocol
- **API Endpoint:** `/jmms/magparser` for loading manuscript data
- **Image Loading:** Custom mechanism via `/jmms/` media prefix

### Key Technical Features
- Supports downloading up to 500 pages
- Configurable thumbnail display (20-30 per page)
- Anti-caching mechanisms for resources
- Dynamic image loading via AJAX requests
- Multi-page and single image view modes

## Implementation Requirements

### 1. Detection Logic
Add to `detectLibrary()` function:
```typescript
if (url.includes('internetculturale.it')) return 'internetculturale';
```

### 2. Library Information
Add to `SUPPORTED_LIBRARIES` array:
```typescript
{
    name: 'Internet Culturale (ICCU)',
    example: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
    description: 'Italian cultural heritage digital library with manuscripts from multiple institutions (BNCF, Laurenziana, ICCU)',
}
```

### 3. Download Handler
Implement `downloadInternetCulturaleManuscript()` method to:

1. **Parse URL:** Extract OAI identifier and teca parameter
2. **API Call:** Request manuscript data from magparser endpoint
3. **Parse Response:** Extract image URLs and metadata
4. **Download Images:** Sequential download with progress tracking
5. **Error Handling:** Institution-specific error responses

### API Endpoint Structure
```
GET /jmms/magparser
Parameters:
- urlpath: /jmms/magparser
- teca: {LIBRARY_NAME}
- ricerca: all
- fulltext: false
- pid: {OAI_IDENTIFIER}
```

## Implementation Challenges

### Medium-High Complexity
1. **Custom API:** Not using standard IIIF - requires reverse-engineering
2. **Multiple Institutions:** Different teca parameters may need different handling
3. **OAI Parsing:** Complex URL-encoded identifiers need proper decoding
4. **Unknown Response Format:** Cannot directly test API due to domain restrictions
5. **Anti-bot Measures:** May require specific headers or rate limiting

### Required Development Steps
1. **Manual API Testing:** Someone with access needs to test magparser endpoint
2. **Response Analysis:** Understand JSON/XML structure from magparser
3. **Error Handling:** Different institutions may have different restrictions
4. **Header Requirements:** May need specific User-Agent or Referer headers
5. **Rate Limiting:** Implement appropriate delays between requests

## Expected Response Format
Based on viewer code analysis, magparser likely returns:
- Manuscript metadata (title, institution, etc.)
- Array of page/image information
- Image URLs with resolution options
- Total page count
- Navigation/thumbnail data

## Testing Strategy
1. **Unit Tests:** URL parsing and OAI identifier extraction
2. **Integration Tests:** API endpoint calls and response parsing
3. **Error Handling:** Institution-specific restrictions and timeouts
4. **End-to-End Tests:** Complete manuscript downloads from each institution
5. **PDF Validation:** Ensure downloaded images merge correctly

## Recommendation

**IMPLEMENT SUPPORT** - This is a significant Italian cultural heritage resource serving major institutions:
- **Biblioteca Nazionale Centrale di Firenze** - Italy's national library
- **Biblioteca Medicea Laurenziana** - Historic Medici library
- **ICCU Collections** - Broader Italian cultural institute collections

The platform represents substantial manuscript collections that would significantly expand European coverage in the downloader.

## Next Steps
1. Manual testing of magparser API endpoint
2. Analysis of response format and image URL patterns
3. Implementation of URL parsing and API integration
4. Testing across different teca (institution) types
5. Development of comprehensive test suite
6. Version bump and release

---
**Report Generated:** 2025-06-18 by Claude Code  
**Files Referenced:** EnhancedManuscriptDownloaderService.ts, project documentation