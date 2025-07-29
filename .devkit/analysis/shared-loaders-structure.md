# SharedManifestLoaders Structure Analysis

## Overview
The `SharedManifestLoaders.js` file contains a central class that manages all library integrations for the manuscript downloader. It provides a unified interface for fetching manuscript manifests from various digital libraries worldwide.

## Key Components

### 1. Core Structure
- **Class**: `SharedManifestLoaders` - Main class that houses all library-specific implementations
- **Constructor**: Accepts a custom fetch function or uses default Node.js HTTPS implementation
- **Central Method**: `getManifestForLibrary(libraryId, url)` - Routes to specific library handlers

### 2. Common Patterns

#### a. Return Format
All library implementations return a consistent format:
```javascript
{
  images: [
    {
      url: "https://...",  // Direct image URL
      label: "Page 1"      // Page label/title
    },
    // ... more pages
  ],
  displayName: "Manuscript Title" // Optional
}
```

#### b. Implementation Types

1. **IIIF-based Libraries** (Most common)
   - Fetch IIIF manifest JSON
   - Parse sequences/canvases structure
   - Extract image URLs with maximum resolution
   - Examples: Verona, Karlsruhe, Library of Congress, Vatican, Toronto

2. **Custom API Libraries**
   - Use library-specific APIs
   - Custom JSON parsing
   - Examples: BDL (BookReader API), MDC Catalonia (__INITIAL_STATE__)

3. **Direct URL Construction**
   - Build image URLs from patterns
   - No manifest fetching needed
   - Examples: BNE Spain, Vienna Manuscripta

4. **HTML Scraping + IIIF**
   - Parse HTML to find manifest URLs
   - Then fetch IIIF manifest
   - Examples: BVPB, Morgan Library

### 3. DZI/Tile-based Implementation Status
Currently, there are **NO DZI (Deep Zoom Image) or tile-based libraries** implemented. All current libraries use either:
- IIIF single image endpoints
- Direct image URLs
- Custom APIs returning full images

The Morgan Library includes ZIF file references (Zoomify format), but these are fetched as complete images, not as tiles.

### 4. Common Implementation Features

#### Resolution Optimization
Many libraries test multiple resolution parameters to find the highest quality:
```javascript
// Examples from various libraries:
`${serviceUrl}/full/max/0/default.jpg`     // Maximum available
`${serviceUrl}/full/full/0/default.jpg`    // Full resolution
`${serviceUrl}/full/4000,/0/default.jpg`   // 4000px width
`${serviceUrl}/full/2000,/0/default.jpg`   // 2000px width
```

#### Error Handling
- Retry logic with exponential backoff
- Timeout protection for slow servers
- SSL bypass for specific domains
- Custom error messages for common issues

#### Special Cases
1. **Verona**: Extended timeouts (120s) due to slow server
2. **University of Graz**: Memory-efficient batch processing for large manuscripts
3. **Florence**: Multiple retry attempts with progressive timeout increases
4. **Manchester**: Server-limited to 2000px maximum dimension

### 5. Adding New Libraries

To add a new library:

1. **Create a new method** named `get[LibraryName]Manifest(url)`
2. **Extract manuscript ID** from the URL pattern
3. **Implement the fetching logic**:
   - For IIIF: Fetch manifest → Parse canvases → Extract image URLs
   - For custom APIs: Call API → Parse response → Build image array
   - For direct URLs: Build URLs from patterns
4. **Return standardized format** with images array
5. **Add to router** in `getManifestForLibrary()` method
6. **Test maximum resolution** - Always find the highest quality available

### 6. Key Utilities

- `fetchWithRetry()`: Handles retries with exponential backoff
- `fetchUrl()`: Low-level HTTPS fetching with timeout and SSL options
- Progressive timeout increases for problematic servers
- Memory-efficient processing for large manuscripts

## Notes for DZI Implementation

If implementing a DZI/tile-based library, you would need to:
1. Identify the DZI manifest URL pattern
2. Fetch and parse the DZI XML
3. Extract tile information (levels, tile size, format)
4. Either:
   - Build full image URLs from the highest level tiles
   - Implement a tile stitching mechanism
5. Return in the standard format with complete image URLs

Currently, the architecture assumes complete images, not tiles, so DZI support would require additional consideration for how to handle tiled images in the download pipeline.