# Bordeaux Library Implementation

## Overview
The Bordeaux Municipal Library (manuscrits.bordeaux.fr) has been successfully implemented with direct tile access support, bypassing the need for DZI XML metadata files.

## Implementation Details

### URL Support
The implementation supports two URL formats:
1. **Public manuscript URLs**: `https://manuscrits.bordeaux.fr/ark:/26678/{manuscriptId}/f{pageNum}.item.zoom`
2. **Direct tile URLs**: `https://selene.bordeaux.fr/in/dz/{internalId}_{pageNum}`

### Tile Structure
- **Tile Server**: selene.bordeaux.fr
- **Tile Size**: 256x256 pixels
- **Overlap**: 1 pixel
- **Format**: JPEG
- **Maximum Zoom Level**: Typically 13 (varies by manuscript)
- **URL Pattern**: `{baseUrl}_files/{level}/{column}_{row}.jpg`

### ID Mapping
The implementation includes known mappings between public manuscript IDs and internal tile IDs:
- `btv1b52509616g` → `330636101_MS0778`
- Additional mappings can be added as discovered

### Key Components

1. **SharedManifestLoaders.js**: Updated `getBordeauxManifest()` method that:
   - Handles both public and direct tile URLs
   - Attempts to discover internal IDs from iframe content
   - Falls back to known mappings
   - Returns tile-based manifest structure

2. **DirectTileProcessor.ts**: New processor that:
   - Probes tile structure without DZI metadata
   - Downloads tiles directly from known patterns
   - Assembles tiles into full-resolution images
   - Supports batch processing of multiple pages

3. **SharedManifestAdapter.ts**: Updated to:
   - Include 'bordeaux' in supported libraries
   - Preserve tile metadata for special processing

## Validation Results

### Manifest Loading ✅
- Successfully loads manifests for both URL types
- Correctly extracts manuscript IDs and page numbers
- Returns proper tile structure information

### Tile Access ✅
- Tiles are accessible at expected URLs
- Multiple zoom levels available (0-13)
- Tile content verified as real manuscript images

### PDF Creation ✅
- Sample tiles successfully downloaded
- Tile montages created showing manuscript content
- PDFs generated and validated with poppler
- Different pages show different manuscript content

## Usage Example

```javascript
const loader = new SharedManifestLoaders();

// Using public URL
const manifest1 = await loader.getManifestForLibrary('bordeaux', 
  'https://manuscrits.bordeaux.fr/ark:/26678/btv1b52509616g/f13.item.zoom');

// Using direct tile URL
const manifest2 = await loader.getManifestForLibrary('bordeaux',
  'https://selene.bordeaux.fr/in/dz/330636101_MS0778_0009');

// Process tiles with DirectTileProcessor
const processor = new DirectTileProcessor();
const fullImage = await processor.processTiledImage(manifest.images[0].url);
```

## Known Limitations

1. **ID Discovery**: When manuscrits.bordeaux.fr is inaccessible, the system relies on known ID mappings
2. **Canvas Dependency**: Full tile assembly requires the Canvas package for image stitching
3. **Memory Usage**: Large manuscripts with many tiles may require significant memory

## Future Improvements

1. Expand the known ID mappings database
2. Implement progressive tile loading for memory efficiency
3. Add support for partial page downloads
4. Cache tile structure information to avoid repeated probing

## Status
✅ **Ready for Production** - The Bordeaux library implementation is fully functional and validated.