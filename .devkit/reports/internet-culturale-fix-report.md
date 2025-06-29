# Internet Culturale API Fix Report

**Version:** 1.0.77  
**Date:** June 18, 2025  
**Issue:** Internet Culturale manifest loading was failing

## Problem Analysis

The Internet Culturale implementation was failing to load manuscripts due to several critical issues:

### 1. **Incorrect API URL Parameters**
- **Problem**: API was called with only `id` parameter
- **Required**: `id`, `teca`, `mode=all`, `fulltext=0`
- **Original**: `https://www.internetculturale.it/jmms/magparser?id=OAI_ID`
- **Fixed**: `https://www.internetculturale.it/jmms/magparser?id=OAI_ID&teca=TECA&mode=all&fulltext=0`

### 2. **Wrong Response Format Expectation**
- **Problem**: Code expected JSON response
- **Reality**: API returns XML
- **Fix**: Changed from `response.json()` to `response.text()` and added XML parsing

### 3. **Incorrect Data Structure Parsing**
- **Problem**: Looking for `manifestData.pages` array with `imgUrl` properties
- **Reality**: XML with `<page>` elements having `src` attributes
- **Fix**: Used regex to extract `src` attributes from XML: `/<page[^>]+src="([^"]+)"[^>]*>/g`

### 4. **Wrong Accept Headers**
- **Problem**: `Accept: application/json`
- **Fix**: `Accept: text/xml, application/xml, */*; q=0.01`

## Implementation Details

### API URL Construction
```javascript
const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
```

### XML Response Parsing
```javascript
// Extract title from XML
const titleMatch = xmlText.match(/<info key="Titolo">\\s*<value>(.*?)<\/value>/);

// Extract page URLs
const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
while ((match = pageRegex.exec(xmlText)) !== null) {
    const relativePath = match[1];
    const imageUrl = `https://www.internetculturale.it/jmms/${relativePath}`;
    pageLinks.push(imageUrl);
}
```

## Test Results

**Test URL:** https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf

**Results:**
- ✅ API call successful (297,780 characters XML response)
- ✅ Found 573 pages in manifest
- ✅ Title extracted: "Missale"
- ✅ Image URLs constructed correctly
- ✅ First image accessible (JPEG format)

**Sample Image URLs:**
1. `https://www.internetculturale.it/jmms/cacheman/normal/Bncf/IT.BNCF/oai.bncf.firenze.sbn.it.21.FI0098.ManoscrittiInRete.B.R.231/1.jpg`
2. `https://www.internetculturale.it/jmms/cacheman/normal/Bncf/IT.BNCF/oai.bncf.firenze.sbn.it.21.FI0098.ManoscrittiInRete.B.R.231/2.jpg`
3. `https://www.internetculturale.it/jmms/cacheman/normal/Bncf/IT.BNCF/oai.bncf.firenze.sbn.it.21.FI0098.ManoscrittiInRete.B.R.231/3.jpg`

## Root Cause

The implementation was based on assumptions about the API format without actually testing the endpoint. The Italian Internet Culturale platform uses:
- XML-based API responses (not JSON)
- Specific parameter requirements (`teca`, `mode`, `fulltext`)
- Relative image paths that need to be converted to absolute URLs

## Files Modified

- `/src/main/services/EnhancedManuscriptDownloaderService.ts` - Fixed `loadInternetCulturaleManifest()` method
- `/package.json` - Version bump to 1.0.77

## Impact

Internet Culturale manuscripts from Italian institutions (BNCF Florence, Biblioteca Laurenziana, etc.) can now be downloaded successfully. This fixes access to thousands of digitized manuscripts from major Italian libraries.

## Next Steps

1. Test with additional Internet Culturale URLs from different institutions
2. Consider adding progress reporting for large manuscripts (573+ pages)
3. Update test suite to include Internet Culturale in automated testing