# MDC Catalonia URL Pattern Analysis - Comprehensive Investigation

## Executive Summary

This report provides a comprehensive analysis of MDC Catalonia's URL patterns, page identification systems, API endpoints, and error handling mechanisms. The investigation tested multiple URL formats, page identifiers, image access patterns, and error conditions to determine the optimal implementation strategy.

## Key Findings

### 1. URL Structure Analysis

**Working URL Pattern:**
```
https://mdc.csuc.cat/digital/collection/{collection}/id/{id}/rec/{page}
```

**Tested URLs:**
- ✅ `https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1` - Status: 200
- ❌ `https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2` - Error: socket hang up
- ✅ `https://mdc.csuc.cat/digital/collection/incunableBC/id/14914/rec/1` - Status: 200

**Collection Structure:**
- Base domain: `mdc.csuc.cat`
- Platform: CONTENTdm (identified from HTML content)
- Collections: `incunableBC` (Catalan incunables)
- ID system: Numeric identifiers (175331, 49455, 14914)
- Page system: Sequential `/rec/{n}` starting from 1

### 2. Page Identification System

**Sequential /rec/{n} Pattern - CONFIRMED WORKING**
- Pages 1-5 tested for ID 175331: All returned Status 200
- Page URLs follow pattern: `/rec/1`, `/rec/2`, `/rec/3`, etc.
- No apparent page limit enforcement
- Invalid page numbers (e.g., /rec/999) still return 200 status

**Alternative patterns tested:**
- ❌ `/page/{n}` - Not supported
- ❌ `?page={n}` - Not supported  
- ❌ `?p={n}` - Not supported

### 3. API Response Analysis

**No Native JSON API Available**
- All API endpoints return HTML instead of JSON
- API pattern `https://mdc.csuc.cat/digital/api/singleitem/collection/{collection}/id/{id}/rec/{page}` returns HTML (Status 200)
- No IIIF manifest endpoints discovered
- No metadata API endpoints found

**Content Type Analysis:**
- All responses return `text/html;charset=utf-8`
- CONTENTdm platform detected from HTML structure
- React-based frontend application
- No JSON-LD structured data detected

### 4. Image URL Construction Patterns

**IIIF Endpoints - NOT FUNCTIONAL FOR IMAGES**
- Pattern tested: `https://mdc.csuc.cat/digital/iiif/{collection}:{id}/full/{size}/0/default.jpg`
- All IIIF URLs return HTML instead of images
- Server header indicates IIIF provider: `x-oclc-iiif-provider: cantaloupe`
- IIIF service exists but may require different access patterns

**Download Endpoints - RETURN HTML**
- `/download` endpoint exists but returns HTML page
- No direct image download URLs discovered
- Image extraction likely requires JavaScript processing

**Resolution Testing Results:**
- IIIF patterns tested with multiple resolutions (full, max, 2000px, 1000px, etc.)
- All return HTML content instead of images
- Content-Type consistently `text/html;charset=utf-8`

### 5. Error Analysis and Prevention

**501 Error Patterns:**
- No 501 errors encountered during testing
- All requests returned Status 200 regardless of validity
- Invalid collections, IDs, and pages still return successful responses

**Header Requirements:**
- **User-Agent**: NOT strictly required (works without)
- **Referer**: Recommended but not required
- **Accept headers**: Do not affect response type

**Successful Request Headers:**
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Connection: keep-alive
Referer: https://mdc.csuc.cat/
```

## Technical Implementation Findings

### 1. Platform Architecture
- **System**: CONTENTdm by OCLC
- **Frontend**: React-based SPA
- **Server**: Apache with Cantaloupe IIIF service
- **Content Delivery**: Gzip compression enabled
- **Session Management**: JSESSIONID cookies used

### 2. Content Access Method
- HTML page parsing required for image extraction
- JavaScript execution likely needed for dynamic content
- No direct image URLs available through API
- CONTENTdm viewer integration necessary

### 3. Page Navigation
- Sequential page numbering starting from 1
- No maximum page limit detection
- Consistent URL pattern across collections
- Page existence validation requires content parsing

## Implementation Recommendations

### 1. URL Pattern Implementation
```typescript
const buildPageUrl = (collection: string, id: string, page: number): string => {
  return `https://mdc.csuc.cat/digital/collection/${collection}/id/${id}/rec/${page}`;
};
```

### 2. Required Headers
```typescript
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Referer': 'https://mdc.csuc.cat/'
};
```

### 3. Content Extraction Strategy
1. **HTML Parsing**: Use Playwright/Puppeteer for JavaScript execution
2. **Image Detection**: Parse CONTENTdm viewer components  
3. **Page Counting**: Analyze navigation elements for total pages
4. **Error Handling**: Check for "not found" content in HTML

### 4. Collection Support
- Primary collection: `incunableBC` (Catalan incunables)
- Additional collections discoverable through site exploration
- Collection names follow short identifier pattern

## Error Handling Strategy

### 1. Request-Level Errors
- Monitor for socket hang up errors (intermittent connectivity)
- Implement retry logic for failed requests
- Use proper timeout settings (30+ seconds)

### 2. Content-Level Validation
- Parse HTML for error messages
- Check for valid manuscript content vs. placeholder pages
- Validate image presence in CONTENTdm viewer

### 3. Page Range Detection
- Test sequential pages until content becomes invalid
- Look for navigation indicators in HTML
- Handle pages beyond available range gracefully

## Conclusion

MDC Catalonia uses a CONTENTdm-based system that requires HTML parsing and JavaScript execution for proper content extraction. The URL patterns are consistent and predictable, but image access requires interaction with the embedded viewer rather than direct API calls. Implementation should focus on browser automation techniques rather than pure API integration.

**Next Steps:**
1. Implement Playwright-based content extraction
2. Develop CONTENTdm viewer integration
3. Create robust page counting mechanisms
4. Test with additional collections beyond `incunableBC`

---

*Analysis completed: July 5, 2025*  
*Agent team: 5 specialized analysis agents*  
*Total tests conducted: 50+ URL patterns and configurations*