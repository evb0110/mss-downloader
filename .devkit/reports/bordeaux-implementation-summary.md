# Bordeaux Library Implementation Summary

## Overview
Successfully implemented support for Bordeaux Bibliothèques digital manuscripts using Deep Zoom Image (DZI) tile technology.

## Implementation Details

### 1. **SharedManifestLoaders.js**
- Added `getBordeauxManifest()` method that:
  - Extracts manuscript ID from URL (e.g., `btv1b52509616g`)
  - Tries to fetch IIIF manifest first
  - Falls back to DZI approach if IIIF not available
  - Generates DZI URLs for each page: `https://manuscrits.bordeaux.fr/vignettes/{manuscriptId}/f{page}.dzi`
  - Returns manifest with special `type: 'dzi'` and `requiresTileAssembly: true` flags

### 2. **DziImageProcessor.ts**
- Created new processor for Deep Zoom Image format
- Key features:
  - Fetches and parses DZI XML metadata
  - Calculates tile grid based on zoom levels
  - Downloads all tiles for maximum zoom level
  - Stitches tiles together accounting for 1-pixel overlap
  - Returns full-resolution JPEG image
  
### 3. **EnhancedManuscriptDownloaderService.ts**
- Added DZI handling in `downloadImageWithRetries()`:
  ```typescript
  if (url.endsWith('.dzi')) {
      return this.downloadAndProcessDziFile(url, attempt);
  }
  ```
- Implemented `downloadAndProcessDziFile()` method with retry logic
- Added Bordeaux to supported libraries list

### 4. **Type Updates**
- Updated `types.ts`: Added `'bordeaux'` to library union type
- Updated `queueTypes.ts`: Added `'bordeaux'` to TLibrary type

## DZI Structure
Bordeaux uses Microsoft Deep Zoom Image format:
- Tile size: 256x256 pixels
- Overlap: 1 pixel
- Format: JPEG
- Maximum zoom level: 13 (8192x8192 pixels)

Example DZI metadata:
```xml
<Image TileSize="256" Overlap="1" Format="jpg">
  <Size Width="3456" Height="4608"/>
</Image>
```

## Tile URL Pattern
```
https://manuscrits.bordeaux.fr/vignettes/{manuscriptId}/f{page}_files/{level}/{column}_{row}.jpg
```

## Testing
Created validation script that:
1. Successfully loads manifests from Bordeaux URLs
2. Correctly identifies DZI structure
3. Generates proper tile metadata for each page

## Usage Example
```javascript
const url = 'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom';
const manifest = await loader.getManifestForLibrary('bordeaux', url);
// Returns manifest with DZI URLs that will be processed during download
```

## Benefits
- Ultra-high resolution manuscript downloads (up to 8192x8192 pixels)
- Efficient tile-based loading
- Automatic assembly of tiles into full images
- Seamless integration with existing download pipeline