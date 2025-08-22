# Florence 403 Forbidden Download Analysis

## Executive Summary

Florence manuscripts are experiencing 403 Forbidden errors during actual image downloads despite successful HEAD requests and manifest loading. The issue occurs after downloading a few pages successfully, suggesting rate limiting or anti-bot measures rather than authentication problems.

## Technical Analysis

### Current Florence Implementation

Florence manuscripts use the **ContentDM IIIF system** hosted at `cdm21059.contentdm.oclc.org` with the following architecture:

1. **Library Detection**: URL pattern `cdm21059.contentdm.oclc.org/digital/collection/plutei`
2. **Manifest Loading**: HTML state extraction from `__INITIAL_STATE__` JavaScript object
3. **Size Testing**: HEAD requests test multiple resolutions [6000px, 4000px, 2048px, 1024px, 800px]
4. **Image URLs**: IIIF format `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:{id}/full/{width},/0/default.jpg`

### HEAD vs GET Request Behavior Analysis

#### HEAD Requests (Working)
- **Purpose**: Size parameter testing during manifest loading
- **Method**: `HEAD` method to check availability without downloading content
- **Headers Used**:
  ```javascript
  {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'image/*',
      'Referer': 'https://cdm21059.contentdm.oclc.org/'
  }
  ```
- **Result**: Successfully determines optimal size (typically 4000px)
- **Timing**: Occurs during manifest loading phase, typically 3-5 HEAD requests total

#### GET Requests (Failing after initial success)
- **Purpose**: Actual image downloads for PDF creation
- **Method**: `GET` method to download full image content
- **Headers Used**: 
  ```javascript
  {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
      'Accept-Language': 'en-US,en;q=0.5'
  }
  ```
- **Result**: First 3-5 downloads succeed, then 403 Forbidden errors begin
- **Error Pattern**: Downloads work initially, then server blocks subsequent requests

### ContentDM Rate Limiting Analysis

#### OCLC ContentDM Server Characteristics
- **Platform**: OCLC's ContentDM digital collection management system
- **Known Issues**: High server load sensitivity, designed for browsing not bulk downloads
- **Geographic Restrictions**: Marked as `geoBlocked: true` (may require Italian IP)

#### Rate Limiting Evidence
1. **Successful Initial Downloads**: 3-5 pages download successfully before errors
2. **403 Pattern**: Suggests request frequency detection rather than authentication failure
3. **30-second Timeout**: Network timeout after 30s indicates server deliberate blocking
4. **HEAD vs GET Difference**: HEAD requests don't trigger rate limiting (minimal server load)

#### ContentDM Anti-Bot Detection Patterns
Based on the code analysis and documented behavior:

1. **Request Volume Detection**: Server allows small number of requests, then blocks
2. **User-Agent Scrutiny**: Different User-Agents between HEAD and GET may trigger detection
3. **Missing Browser Headers**: GET requests lack browser-specific headers that HEAD has
4. **Connection Pattern Analysis**: Rapid sequential downloads trigger protection

### Current Florence Configuration Issues

#### Network Configuration Problems
1. **Inconsistent Headers**: HEAD and GET requests use different User-Agent strings
2. **Missing ContentDM Headers**: No specific ContentDM referrer chain or session headers
3. **Aggressive Retry**: 11 retries with exponential backoff may compound rate limiting

#### Header Discrepancies
```javascript
// HEAD requests (working)
'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
'Referer': 'https://cdm21059.contentdm.oclc.org/'

// GET requests (failing)  
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
// Missing Referer header
```

#### Connection Management Issues
Current Florence-specific settings:
- `maxSockets: 3` - Reduces concurrent connections
- `keepAliveMsecs: 60000` - Long keep-alive duration
- `timeout: 60000` - 60-second timeout
- `scheduling: 'fifo'` - Predictable connection scheduling

These settings help with stability but don't address rate limiting detection.

## Root Cause Analysis

### Primary Cause: ContentDM Rate Limiting
The 403 Forbidden errors after successful initial downloads indicate **OCLC ContentDM's anti-bot protection**:

1. Server allows small "preview" batch (3-5 requests)
2. Detects bulk download pattern
3. Blocks subsequent requests with 403 Forbidden
4. HEAD requests don't count toward rate limit (minimal server impact)

### Secondary Causes

1. **Header Inconsistency**: Different User-Agents between manifest and download phases
2. **Missing Session Context**: No referrer chain to simulate browser navigation
3. **Geographic Restrictions**: May require Italian IP address for full access
4. **Request Pattern Recognition**: Sequential downloads without browsing delays

## Recommended Fixes

### 1. Header Standardization (High Priority)
Unify headers between HEAD and GET requests:

```javascript
// Standard headers for all Florence requests
const florenceHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,it;q=0.8', // Include Italian for locale
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://cdm21059.contentdm.oclc.org/',
    'Origin': 'https://cdm21059.contentdm.oclc.org',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-origin'
};
```

### 2. Download Pattern Mitigation (High Priority)
Implement human-like browsing behavior:

```javascript
const FLORENCE_DOWNLOAD_DELAY = 2000; // 2 seconds between requests
const FLORENCE_BATCH_SIZE = 3; // Download 3 pages, then pause
const FLORENCE_BATCH_DELAY = 10000; // 10 second pause between batches
```

### 3. Session Simulation (Medium Priority)
Add session-like behavior:

1. **Initial Browse Simulation**: Make a request to the main collection page before downloads
2. **Referrer Chain**: Include proper referrer progression
3. **Cookie Handling**: Maintain session cookies if present

### 4. Request Distribution (Medium Priority)
Spread downloads over time:

1. **Chunked Downloads**: Process in smaller batches with delays
2. **Random Intervals**: Add randomness to avoid pattern detection
3. **Connection Reuse**: Reuse connections to simulate browser behavior

### 5. Error Recovery Strategy (Low Priority)
When 403 occurs:

1. **Exponential Backoff**: Wait longer between retry attempts (start at 30s)
2. **Header Rotation**: Slightly vary User-Agent strings
3. **Connection Reset**: Close and reopen connections
4. **IP Detection**: Warn users about potential geographic restrictions

## Implementation Plan

### Phase 1: Header Standardization
1. Update `FlorenceLoader.ts` to use consistent headers
2. Update `EnhancedDownloadQueue.ts` Florence download logic
3. Ensure all Florence requests use identical headers

### Phase 2: Rate Limiting Mitigation  
1. Add Florence-specific delay logic to download queue
2. Implement batch processing with pauses
3. Add request distribution timing

### Phase 3: Session Simulation
1. Add initial collection page request before downloads
2. Implement proper referrer chain maintenance
3. Handle ContentDM session cookies

### Phase 4: Testing and Validation
1. Test with multiple Florence manuscripts
2. Validate download completion rates
3. Monitor for new error patterns

## Alternative Solutions

### 1. Proxy/VPN Detection
If geographic restrictions are the primary issue:
- Detect user IP location
- Warn about Italian IP requirements
- Provide guidance for VPN usage

### 2. IIIF Manifest Approach
Investigate if Florence provides IIIF manifests:
- Check for standard IIIF manifest endpoints
- Alternative to HTML state extraction
- May have different rate limiting rules

### 3. Progressive Download Strategy
For large manuscripts:
- Download in smaller chunks over extended time
- Store partial progress  
- Resume capability for interrupted downloads

## ContentDM Best Practices

Based on OCLC ContentDM documentation and observed behavior:

1. **Respect Server Load**: ContentDM optimized for interactive browsing, not bulk downloads
2. **Use Appropriate Delays**: 1-2 seconds minimum between requests
3. **Limit Concurrent Connections**: Maximum 2-3 simultaneous requests
4. **Include Proper Context**: Referrer headers and session information
5. **Handle Geographic Restrictions**: Some institutions restrict by IP location

## Monitoring and Metrics

Track the following to validate fixes:

1. **Success Rate**: Percentage of complete manuscript downloads
2. **Error Distribution**: 403 vs other error types
3. **Download Timing**: Average time per page, total manuscript time  
4. **Failure Points**: At what page count do 403 errors typically occur
5. **Geographic Correlation**: Success rates by user location

## Conclusion

The Florence 403 Forbidden issue is primarily caused by **ContentDM's anti-bot rate limiting** triggered by bulk download patterns that differ from normal browser behavior. The fix requires:

1. **Standardized headers** between manifest and download phases
2. **Human-like request timing** with delays and batch processing
3. **Proper browser simulation** with referrer chains and session context

The technical implementation is straightforward, but success depends on closely mimicking legitimate browser behavior to avoid ContentDM's protection mechanisms.