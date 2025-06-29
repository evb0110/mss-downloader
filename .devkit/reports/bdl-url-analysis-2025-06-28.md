# BDL (Biblioteca Digitale Lombarda) Download Failure Analysis

**Date:** 2025-06-28  
**URL Analyzed:** `https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903`  
**Status:** ❌ IIIF Image Server Issues Identified

## Executive Summary

The BDL (Biblioteca Digitale Lombarda) library implementation in the MSS Downloader is **correctly implemented**, but downloads are failing due to **server-side issues with the BDL IIIF image service**. The API integration works perfectly, but the image delivery mechanism is experiencing HTTP 500 Internal Server Errors.

## Technical Analysis

### 1. Library Detection ✅ WORKING

The URL detection and parsing is functioning correctly:

```typescript
// URL Pattern Detection
if (url.includes('bdl.servizirl.it')) return 'bdl';

// Parameter Extraction
const urlParams = new URLSearchParams(bdlUrl.split('?')[1]);
const manuscriptId = urlParams.get('cdOggetto'); // 3903
const pathType = urlParams.get('path'); // fe
```

**Result:** BDL URLs are properly detected and manuscript ID extracted.

### 2. API Integration ✅ WORKING

The BDL API endpoint is functioning correctly:

```bash
# API Call Success
curl "https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages"
# Returns: 302 pages with complete metadata
```

**Sample API Response:**
```json
{
  "thumbWidth": 150,
  "readerWidth": 1272,
  "readerHeight": 1703,
  "thumbHeight": 150,
  "zoomWidth": 2545,
  "zoomHeight": 3407,
  "doublePage": false,
  "idMediaServer": 1460756,
  "cantaloupeUrl": "https://www.bdl.servizirl.it/cantaloupe/",
  "idMediaServerPdf": 1460896,
  "mediaServerPdf": "https://www.bdl.servizirl.it/mediaserver-server-pdf/",
  "id": "1"
}
```

**Result:** API returns complete page metadata including image IDs.

### 3. IIIF Image Construction ✅ CORRECT FORMAT

The image URL construction follows IIIF 2.0 specification:

```typescript
const imageUrl = `https://www.bdl.servizirl.it/cantaloupe/iiif/2/${page.idMediaServer}/full/full/0/default.jpg`;
```

**Expected URL:** `https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/full/0/default.jpg`

### 4. Server Response Analysis ❌ FAILING

**IIIF Image Endpoint:**
```bash
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/full/0/default.jpg"
# Returns: HTTP 500 Internal Server Error
```

**IIIF Info Endpoint:**
```bash
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/info.json"
# Returns: HTTP 500 Internal Server Error
```

**PDF Media Server:**
```bash
curl -I "https://www.bdl.servizirl.it/mediaserver-server-pdf/1460896"
# Returns: HTTP 404 Not Found
```

## Root Cause Analysis

### Primary Issue: IIIF Server Failure

The BDL IIIF image server (`cantaloupe`) is experiencing internal server errors:

1. **Error Type:** HTTP 500 Internal Server Error
2. **Scope:** All IIIF endpoints (image and info.json)
3. **Frequency:** Consistent failures across multiple image IDs
4. **Impact:** Complete failure of image delivery

### Possible Causes

1. **Server Misconfiguration**
   - Cantaloupe IIIF server not properly configured
   - Image storage path misalignment
   - Database connection issues

2. **Resource Access Issues**
   - Images not accessible to IIIF server
   - File permission problems
   - Storage service outage

3. **Load Balancer Issues**
   - Multiple cookies (BIGipServer, TS018377dd) suggest load balancing
   - Possible backend server failure
   - Session affinity problems

4. **Maintenance/Downtime**
   - Server maintenance in progress
   - System updates affecting image service
   - Database migration or indexing

## Implementation Quality Assessment

### ✅ MSS Downloader Implementation: CORRECT

The MSS Downloader implementation is **technically sound**:

1. **URL Detection:** Properly identifies BDL URLs
2. **API Integration:** Correctly calls BDL REST API
3. **Parameter Parsing:** Extracts manuscriptId and path correctly
4. **IIIF URL Construction:** Follows IIIF 2.0 specification
5. **Error Handling:** Includes timeout and retry logic
6. **Validation:** Performs first-image validation

### 🔧 BDL Server Implementation: NEEDS ATTENTION

The BDL server infrastructure has issues:

1. **API Service:** Working correctly
2. **IIIF Service:** Experiencing server errors
3. **PDF Service:** Endpoint not accessible
4. **Load Balancing:** Complex cookie-based routing

## Troubleshooting Results

### Attempted Solutions

1. **Alternative URL Patterns:** Tested various IIIF URL formats - all fail
2. **Direct Image Access:** Attempted bypass of IIIF layer - not available
3. **PDF Server Access:** Tried PDF media server - endpoints not found
4. **Info.json Validation:** Checked IIIF metadata endpoint - server error

### Network Analysis

- **DNS Resolution:** ✅ Working
- **SSL Connection:** ✅ Working  
- **HTTP Response:** ❌ 500 Server Error
- **Load Balancer:** ✅ Responding with cookies
- **API Endpoints:** ✅ Working correctly

## Recommendations

### For MSS Downloader Users

1. **Wait for Server Recovery:** The BDL IIIF service may be temporarily down
2. **Try Alternative Manuscripts:** Test with different cdOggetto IDs
3. **Retry Later:** Server issues may be transient
4. **Contact BDL Support:** Report IIIF server issues to Biblioteca Digitale Lombarda

### For BDL System Administrators

1. **Check Cantaloupe Configuration:** Verify IIIF server settings
2. **Review Image Storage:** Ensure images are accessible to IIIF service
3. **Monitor Load Balancer:** Check backend server health
4. **Database Connectivity:** Verify image metadata access
5. **Error Logging:** Check server logs for specific error details

### For MSS Downloader Development

1. **Enhanced Error Handling:** Add specific HTTP 500 error messages
2. **Fallback Mechanisms:** Consider alternative image access methods
3. **User Notification:** Inform users about BDL server status
4. **Monitoring:** Add health checks for BDL IIIF service

## Verification Commands

To verify current BDL server status:

```bash
# Test API (should work)
curl -s "https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages" | jq length

# Test IIIF (currently failing)
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/full/full/0/default.jpg"

# Test Info endpoint (currently failing)
curl -I "https://www.bdl.servizirl.it/cantaloupe/iiif/2/1460756/info.json"
```

## Conclusion

**The MSS Downloader BDL implementation is correct and complete.** Downloads are failing due to **server-side issues with the BDL IIIF image service**, not due to implementation problems in the manuscript downloader.

The issue requires resolution by BDL system administrators, not changes to the MSS Downloader codebase.

**Status:** ⏳ Waiting for BDL server resolution  
**Action Required:** External (BDL system administrators)  
**User Impact:** Complete download failure for BDL manuscripts  
**Timeline:** Unknown - depends on BDL server maintenance