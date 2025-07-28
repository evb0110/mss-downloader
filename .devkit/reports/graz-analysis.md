# University of Graz Library Analysis Report

## Issue Summary
User reports that the Graz library is still failing in v1.4.43 with "endless manifest loading" and JavaScript errors. The specific URL provided by the user is:
- `https://gams.uni-graz.at/context:rbas.ms.P0008s11`

## Root Cause Analysis

### 1. URL Pattern Mismatch
The current implementation only supports URLs from the `unipub.uni-graz.at` subdomain, but the user is trying to use a URL from `gams.uni-graz.at` (GAMS - Geisteswissenschaftliches Asset Management System).

**Current supported patterns:**
- `https://unipub.uni-graz.at/obvugrscript/content/titleinfo/{ID}`
- `https://unipub.uni-graz.at/obvugrscript/content/pageview/{ID}`

**User's URL pattern (NOT SUPPORTED):**
- `https://gams.uni-graz.at/context:rbas.ms.P0008s11`

### 2. Library Detection Failure
In `EnhancedManuscriptDownloaderService.ts`, the `detectLibrary()` method only checks for:
```javascript
if (url.includes('unipub.uni-graz.at')) return 'graz';
```

This means URLs from `gams.uni-graz.at` are not recognized as Graz library URLs.

### 3. Manifest Extraction Failure
In `SharedManifestLoaders.js`, the `getGrazManifest()` method tries to extract a numeric ID:
```javascript
const manuscriptIdMatch = url.match(/\/(\d+)$/);
```

However, the GAMS URL pattern uses a different format: `context:rbas.ms.P0008s11` instead of a numeric ID.

## Technical Details

### Current Implementation Flow
1. User enters URL: `https://gams.uni-graz.at/context:rbas.ms.P0008s11`
2. `detectLibrary()` fails to identify it as 'graz' (only checks for 'unipub.uni-graz.at')
3. The system returns "Unsupported library for URL"
4. If forced to use Graz handler, `getGrazManifest()` fails with "Could not extract manuscript ID from Graz URL"

### Why It Appears as "Endless Loading"
The user reports "endless manifest loading" which suggests:
1. The UI might be stuck in a loading state when the library detection fails
2. JavaScript errors occur when the system can't identify the library
3. No proper error message is displayed to the user

## GAMS vs UniPub Systems

### UniPub (Currently Supported)
- Digital repository for University of Graz publications
- Uses IIIF manifests at `https://unipub.uni-graz.at/i3f/v20/{ID}/manifest`
- Numeric IDs for manuscripts

### GAMS (Not Supported)
- Geisteswissenschaftliches Asset Management System
- Different URL structure using context and identifiers
- May use different manifest/API structure
- Example: `context:rbas.ms.P0008s11` where:
  - `context:rbas` might be a collection identifier
  - `ms.P0008s11` might be the manuscript identifier

## Recommendations

### 1. Immediate Fix - Add Error Handling
- Improve error messages when library detection fails
- Prevent UI from getting stuck in "endless loading" state
- Show clear error: "This URL format is not currently supported"

### 2. Long-term Fix - Add GAMS Support
To support GAMS URLs, we need to:
1. Update `detectLibrary()` to recognize `gams.uni-graz.at`
2. Create a separate handler for GAMS URLs (different from UniPub)
3. Research GAMS API/manifest structure
4. Implement proper ID extraction for GAMS context URLs

### 3. Investigation Needed
- Check if GAMS provides IIIF manifests
- Determine the API structure for GAMS
- Test if GAMS manuscripts can be accessed programmatically

## Test Results

### Working URL (UniPub)
```
URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
Result: ✓ Successfully loads 405 pages
Time: 1.3 seconds
```

### Failing URL (GAMS)
```
URL: https://gams.uni-graz.at/context:rbas.ms.P0008s11
Result: ✗ "Could not extract manuscript ID from Graz URL"
Reason: URL pattern not recognized
```

## Conclusion

The issue is not with the existing Graz implementation (which works fine for UniPub URLs) but rather that the user is trying to use URLs from a completely different system (GAMS) that is not currently supported. The "endless loading" is likely due to poor error handling when an unsupported URL is entered.

The fix requires either:
1. Adding proper error messages for unsupported URLs (quick fix)
2. Implementing full support for GAMS URLs (requires research and development)