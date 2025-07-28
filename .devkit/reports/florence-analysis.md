# Florence ContentDM Analysis Report

## Issue Description
User reports "появилась новая проблема, аналогичная Грац" (new problem appeared, similar to Graz) with:
- "ошибка javascript" (JavaScript error)
- "бесконечная загрузка манифеста" (endless manifest loading)

## Investigation Findings

### 1. Current Implementation Status
The Florence ContentDM implementation in `SharedManifestLoaders.js` (lines 1228-1361) includes:
- ✅ Timeout protection (2 minutes)
- ✅ Increased retries (5 attempts)
- ✅ Extended timeout in fetchUrl for cdm21059.contentdm.oclc.org
- ✅ Fallback to direct IIIF when __INITIAL_STATE__ parsing fails
- ✅ Proper error handling with timeout detection

### 2. Testing Results

#### Direct URL Testing
- **Page Loading**: ✅ Successfully loads in ~1-2 seconds
- **__INITIAL_STATE__**: ✅ Present and parseable
- **IIIF Endpoint**: ✅ Accessible and returns valid images
- **Multiple URLs**: ✅ All test URLs (317515, 317539, 100) return 200 OK

#### JavaScript Analysis
- Found minimal JavaScript errors in the page
- __INITIAL_STATE__ is properly set but lacks try-catch wrapping
- No console errors or obvious runtime issues detected
- ContentDM components are present and functional

### 3. Potential Issues Identified

#### A. Race Condition in Electron Context
The issue may be specific to the Electron renderer process where:
1. The page loads but JavaScript execution is delayed
2. The manifest loader times out before __INITIAL_STATE__ is ready
3. This creates an "endless loading" appearance

#### B. CORS or Security Context
In Electron, the security context might interfere with:
- Cookie handling for ContentDM session
- JavaScript execution timing
- Cross-origin requests to IIIF endpoints

#### C. Regex Parsing Edge Cases
The __INITIAL_STATE__ regex might fail on certain manuscripts if:
- The JSON contains unescaped characters
- The state is particularly large (causing regex backtracking)
- The HTML structure varies between manuscripts

### 4. Recommended Fixes

#### Fix 1: Enhanced Timeout and Retry Logic
```javascript
// Add progressive timeout increase for Florence
const timeoutDuration = url.includes('cdm21059.contentdm.oclc.org') 
    ? 120000 * (attempt + 1) // 2min, 4min, 6min...
    : 120000;
```

#### Fix 2: Improved __INITIAL_STATE__ Extraction
```javascript
// More robust regex with lazy quantifier to prevent catastrophic backtracking
const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*?)"\s*\)\s*;/);

// Alternative: Extract and evaluate safely
if (!stateMatch) {
    const scriptMatch = html.match(/<script[^>]*>([^<]*window\.__INITIAL_STATE__[^<]*)<\/script>/);
    if (scriptMatch) {
        try {
            const sandbox = { window: {}, JSON };
            eval.call(sandbox, scriptMatch[1]);
            initialState = sandbox.window.__INITIAL_STATE__;
        } catch (e) {
            // Continue with fallback
        }
    }
}
```

#### Fix 3: Early IIIF Fallback
```javascript
// Try IIIF endpoint first before attempting HTML parsing
async function getFlorenceManifest(url) {
    const itemId = url.match(/\/id\/(\d+)/)?.[1];
    if (!itemId) throw new Error('Invalid Florence URL');
    
    // Try direct IIIF first (faster and more reliable)
    try {
        const iiifTest = await this.fetchWithRetry(
            `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/info.json`,
            {}, 1 // Quick single attempt
        );
        
        if (iiifTest.ok) {
            // Use simple IIIF approach
            return {
                images: [{
                    url: `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/full/0/default.jpg`,
                    label: 'Page 1'
                }]
            };
        }
    } catch (e) {
        // Continue with HTML parsing
    }
    
    // ... existing HTML parsing logic ...
}
```

#### Fix 4: Electron-Specific Headers
```javascript
// Add Electron-specific headers that might help with ContentDM
headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
}
```

### 5. Immediate Workaround
For users experiencing issues, they can:
1. Use direct IIIF manifest URLs if available
2. Try downloading single pages instead of full manuscripts
3. Clear app cache and retry
4. Use a different manuscript ID to test if issue is item-specific

### 6. Testing Strategy
1. Create comprehensive E2E test for Florence with timeout scenarios
2. Test with various manuscript IDs (single page, multi-page, large collections)
3. Monitor memory usage during manifest loading
4. Add telemetry to track where exactly the timeout occurs

## Conclusion
The issue appears to be related to timing and JavaScript execution in the Electron context rather than a fundamental problem with the Florence implementation. The server is responsive, IIIF endpoints work, and the __INITIAL_STATE__ is parseable. The recommended fixes focus on making the implementation more robust against timing issues and providing better fallback mechanisms.