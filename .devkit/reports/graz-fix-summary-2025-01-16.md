# University of Graz Fix Summary
Date: 2025-01-16

## Issue Report
User reported that University of Graz manuscripts were failing to load with error:
`Error invoking remote method 'parse-manuscript-url': Error: Failed to load University of Graz manuscript: fetch failed`

Three URLs were provided:
1. https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
2. https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540
3. https://unipub.uni-graz.at/download/webcache/1504/8224544

## Investigation Results

### URL 1 & 2: Working correctly
- Both URLs were loading successfully with the existing implementation
- The pageview URL correctly converts to titleinfo ID (pageview ID - 2)
- Both URLs point to the same manuscript: "Graz, Universitätsbibliothek Ms 0771" with 405 pages

### URL 3: Issue identified
- This is a direct image URL pattern, not a manuscript URL
- The URL format is: `/download/webcache/{SIZE}/{PAGE_ID}`
- Cannot reliably determine manuscript ID from a single image URL
- Page 8224544 is actually page 3 of manuscript 8224538

## Fix Applied
Updated the `loadGrazManifest` function to properly handle direct webcache URLs by throwing a helpful error message:

```typescript
if (grazUrl.includes('/download/webcache/')) {
    throw new Error('Direct webcache image URLs cannot be used to download full manuscripts. Please use a titleinfo or pageview URL instead (e.g., https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538)');
}
```

## Validation Results
- ✅ URL 1 (titleinfo): Downloads successfully, 405 pages, high-res images (2000x2624px)
- ✅ URL 2 (pageview): Correctly converts to titleinfo and downloads same manuscript
- ✅ URL 3 (webcache): Properly rejects with helpful error message guiding user to use correct URL format

## User Experience Improvement
When users try to use a direct image URL, they now get a clear error message explaining:
1. Why the URL cannot be used
2. What type of URL they should use instead
3. An example of the correct URL format

## Technical Notes
- University of Graz uses IIIF 2.0 manifests
- Images are available in multiple resolutions (1000px, 2000px)
- The implementation correctly uses the highest resolution (2000px) for best quality
- The library supports both titleinfo and pageview URL patterns