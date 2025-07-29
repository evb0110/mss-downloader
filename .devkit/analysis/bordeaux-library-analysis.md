# Bordeaux Library (selene.bordeaux.fr) Analysis

## Issue Context
- **Issue #6**: Bordeaux library support
- **URL**: https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778
- **Key Challenge**: Images with high resolution are assembled from pieces (tiles)
- **Requirement**: Need to handle zoom functionality

## Initial Investigation

### 1. Page Structure
The main page is a Single Page Application (SPA) with:
- Vue.js or similar framework (`<div id="app">`)
- Main app bundle: `/appstatic/js/app.0cda79d8f0e27110f906.js`
- Settings configuration: `/in/rest/api/settings.js`

### 2. API Endpoints Discovered
- Settings: `https://selene.bordeaux.fr/in/rest/api/settings.js`
- Notice API (empty response): `/in/rest/api/notice/ark:/27705/330636101_MS_0778`

### 3. Configuration Analysis
From `settings.js`:
```javascript
window._appProfiles = ["bdx","openIdConnect2","px"];
```
- Uses OpenID Connect for authentication
- Has a REST API under `/in/rest/api/`
- Catalog type: "unimarc"
- Content types include "BordeauxMetropolePhysicalDocument"

### 4. Challenges Encountered
1. The page is a SPA that likely loads viewer components dynamically
2. Direct API endpoints for images/manifests are not immediately visible
3. No standard IIIF endpoints found at common paths
4. The viewer implementation is embedded within the main application

## Next Steps for Investigation

### 1. Dynamic Analysis Needed
Since the page is a SPA, we need to:
- Use a headless browser to load the page fully
- Intercept network requests to find image tile endpoints
- Look for DZI (Deep Zoom Image) file requests

### 2. Potential Viewer Technologies
Based on the mention of tiled images:
- **OpenSeadragon** with DZI format
- **IIPImage** server
- Custom tile server implementation

### 3. Authentication Considerations
The site uses OpenID Connect, which might require:
- Session cookies for accessing images
- Token-based authentication for API calls

## Technical Approach

### 1. Browser Automation Strategy
```javascript
// Pseudocode for intercepting tile requests
page.on('request', request => {
  const url = request.url();
  if (url.includes('.dzi') || url.includes('_files/')) {
    // Capture DZI manifest or tile URLs
  }
});
```

### 2. Expected DZI Structure
If using Deep Zoom Images:
- Manifest file: `image.dzi` (XML format)
- Tile pattern: `image_files/{level}/{column}_{row}.jpg`

### 3. Resolution Handling
The issue mentions "high resolution assembled from pieces":
- Need to identify maximum zoom level
- Calculate total image dimensions
- Implement tile stitching algorithm

## Discovered Implementation Details

### 1. Viewer Technology
- **Type**: OpenSeadragon with Deep Zoom Images (DZI)
- **Framework**: Embedded in iframe at `/in/imageReader.xhtml`
- **Tile Format**: JPEG tiles at 256x256 pixels

### 2. Image Structure
From the OpenSeadragon viewer analysis:
```javascript
{
  "tilesUrl": "/in/dz/330636101_MS0778_0006_files/",
  "fileFormat": "jpg",
  "width": 5500,
  "height": 4175,
  "tileOverlap": 1,
  "minLevel": 0,
  "maxLevel": 13,
  "TileSize": 256
}
```

### 3. URL Patterns

#### Iframe URL Pattern
```
https://selene.bordeaux.fr/in/imageReader.xhtml?id=ark:/27705/{manuscript_id}&locale=en&embedded=true&ark=ark:/27705/{manuscript_id}
```

#### Tile URL Pattern
```
https://selene.bordeaux.fr/in/dz/{manuscript_id}_{page}_files/{level}/{column}_{row}.jpg
```
Example: `/in/dz/330636101_MS0778_0006_files/11/2_3.jpg`

#### Thumbnail Pattern
```
https://selene.bordeaux.fr/in/dz/thumb/256/{manuscript_id}_{page}.jpg
```

### 4. Deep Zoom Structure
- **Max Level**: 13 (highest resolution)
- **Tile Size**: 256x256 pixels
- **Overlap**: 1 pixel
- **Total Image Size**: 5500x4175 pixels (for page 0006)

### 5. Page Navigation
The manuscript has multiple pages:
- 330636101_MS0778_0006
- 330636101_MS0778_0007
- 330636101_MS0778_0008
- ... up to at least 0023

## Implementation Strategy

### 1. Manuscript Discovery
1. Load the iframe viewer URL
2. Extract OpenSeadragon configuration
3. Get list of available pages from thumbnails

### 2. Tile Download Algorithm
```javascript
// For maximum resolution (level 13)
const level = 13;
const tileSize = 256;
const overlap = 1;
const effectiveTileSize = tileSize - overlap;

const cols = Math.ceil(width / effectiveTileSize);
const rows = Math.ceil(height / effectiveTileSize);

for (let col = 0; col < cols; col++) {
  for (let row = 0; row < rows; row++) {
    const tileUrl = `/in/dz/${manuscriptId}_${page}_files/${level}/${col}_${row}.jpg`;
    // Download tile
  }
}
```

### 3. Image Stitching
1. Download all tiles for the highest level
2. Create canvas with full image dimensions
3. Place tiles considering the 1-pixel overlap
4. Export as single high-resolution image

### 4. Authentication
- No special authentication required for public manuscripts
- Standard HTTP headers sufficient

## Verified Working Solution

### Test Results
1. **Thumbnail Access**: ✓ Working (256x256 preview images)
2. **Tile Access**: ✓ Working at all zoom levels (9, 11, 13)
3. **Image Quality**: ✓ Real manuscript content confirmed
4. **Page Range**: Pages start from 0006 (not 0001), continue to at least 0050
5. **Authentication**: ✓ No special authentication required

### Tile Download Statistics (Level 13)
- **Tile Grid**: 22x17 = 374 tiles per page
- **Estimated Size**: ~2 MB per page
- **Tile Size**: 256x256 pixels with 1-pixel overlap

## Implementation Plan

### 1. URL Constructor
```javascript
class BordeauxLibrary {
  getIframeUrl(manuscriptId) {
    return `https://selene.bordeaux.fr/in/imageReader.xhtml?id=ark:/27705/${manuscriptId}&locale=en&embedded=true`;
  }
  
  getTileUrl(manuscriptId, page, level, col, row) {
    return `https://selene.bordeaux.fr/in/dz/${manuscriptId}_${page}_files/${level}/${col}_${row}.jpg`;
  }
  
  getThumbnailUrl(manuscriptId, page) {
    return `https://selene.bordeaux.fr/in/dz/thumb/256/${manuscriptId}_${page}.jpg`;
  }
}
```

### 2. Page Discovery
- Use HEAD requests to thumbnails to find available pages
- Pages are zero-padded 4-digit numbers (0006, 0007, etc.)
- Start checking from 0001 and continue until 404

### 3. Tile Download Process
1. For each page, calculate tile grid dimensions
2. Download all tiles at level 13 (maximum quality)
3. Handle network errors with retry logic
4. Save tiles temporarily for stitching

### 4. Image Stitching
- Create canvas with full dimensions (5500x4175 for example page)
- Place tiles accounting for 1-pixel overlap
- First row/column tiles use full 256 pixels
- Subsequent tiles crop 1 pixel from top/left edges

## Current Status
- **Successfully analyzed**: ✓ Complete technical implementation discovered
- **Verified working**: ✓ Downloads tested and manuscript content confirmed
- **Ready for implementation**: All URL patterns and parameters documented
- **No blockers**: Public access confirmed, no authentication needed

## Final Recommendations
1. Implement BordeauxLibrary class with tile download logic
2. Use level 13 for maximum quality (5500x4175 pixels)
3. Add progress tracking for 374 tiles per page
4. Implement retry logic for network failures
5. Process pages sequentially with small delays between requests
6. Clean up temporary tile files after stitching each page