# Oberösterreichische Landesbibliothek (Linz) - Implementation Research

## Library Overview
- **Name**: Oberösterreichische Landesbibliothek (Upper Austrian State Library)
- **Location**: Linz, Austria
- **Platform**: Goobi viewer (similar to Graz)
- **Digital Collection URL**: https://digi.landesbibliothek.at/
- **Issue**: #25 (Russian: "линц - добавить новую библиотеку")

## Technical Architecture

### IIIF Implementation
- **Version**: IIIF Presentation API 2.0 + Image API 2.0
- **Profile**: Level 2 (full feature support)
- **Max Resolution**: 30000x20000 pixels supported
- **Format Support**: TIFF source, serves JPG/PNG

### URL Patterns

#### Viewer URLs
- Main viewer: `https://digi.landesbibliothek.at/viewer/image/{ID}/`
- Mirador viewer: `https://digi.landesbibliothek.at/viewer/mirador/?manifest=...`
- Example: `https://digi.landesbibliothek.at/viewer/image/116/`

#### API Endpoints
- IIIF Manifest: `https://digi.landesbibliothek.at/viewer/api/v1/records/{ID}/manifest/`
- Image base: `https://digi.landesbibliothek.at/viewer/api/v1/records/{ID}/files/images/{FILENAME}.tif`
- Info.json: `{imageBase}/info.json`

#### Image URL Structure
```
https://digi.landesbibliothek.at/viewer/api/v1/records/{ID}/files/images/{FILENAME}.tif/{region}/{size}/{rotation}/{quality}.{format}
```
- Filename pattern: `00000001.tif`, `00000002.tif`, etc. (8-digit zero-padded)
- Optimal size parameter: `full/full` or `full/max` (both give maximum resolution)

### Manuscript IDs
Tested and confirmed working IDs:
- 116 - Breviarium, dt., saec. XVI (375 pages)
- 254 - Sammelhandschrift, lat. (13th century)
- 279 - Kochbuch, 1846
- 1042, 1043, 1044, 1046 - Urkunde documents
- 1194 - Artzneybuech, 1762
- 1196 - Protokoll
- LMO_525 - Music manuscript (special prefix)

### Metadata Structure
The manifest includes rich metadata:
- Title (label)
- Shelfmark (Signatur)
- Dating (Datierung)
- Language (Sprache)
- Size (Größe)
- Material description
- Provenance
- AC number
- License information (CC BY-SA 3.0 AT)

## Implementation Requirements

### 1. LinzLoader Class
Create `src/main/services/library-loaders/LinzLoader.ts`:
- Extend BaseLibraryLoader
- Library name: 'linz' or 'ooe_landesbibliothek'
- URL detection: `digi.landesbibliothek.at`

### 2. URL Pattern Extraction
Extract manuscript ID from various URL formats:
- `/viewer/image/{ID}/` - Direct viewer
- `/viewer/api/v1/records/{ID}/manifest/` - Manifest URL
- Handle special prefixes like `LMO_` for music manuscripts

### 3. Manifest Loading
1. Extract ID from input URL
2. Construct manifest URL: `/viewer/api/v1/records/{ID}/manifest/`
3. Parse IIIF v2 manifest structure
4. Extract canvases from sequences[0].canvases
5. For each canvas, get image from images[0].resource.service['@id']

### 4. Image Resolution Optimization
- Always use `full/max` or `full/full` for maximum quality
- Both parameters return the same maximum resolution
- File sizes: ~2.4MB for full resolution pages

### 5. Error Handling
- Check for 404 on invalid manuscript IDs
- Handle special manuscript prefixes (LMO_, etc.)
- Validate manifest JSON structure

### 6. Registration
1. Add to `src/main/services/library-loaders/index.ts`
2. Add 'linz' to supported libraries in SharedManifestAdapter
3. Add detection logic to SharedManifestLoaders.js

## Testing Requirements

### Test Cases
1. Standard manuscript URL (e.g., ID 116)
2. Music manuscript with prefix (LMO_525)
3. Document collections (Urkunde series)
4. Large manuscripts (375+ pages)
5. Invalid manuscript IDs (should fail gracefully)

### Validation Steps
1. Verify manifest loads correctly
2. Check all pages are extracted
3. Confirm maximum resolution is used
4. Test PDF generation from downloaded images
5. Verify metadata extraction (title, shelfmark)

## Similar Libraries
The implementation is similar to:
- **GrazLoader**: Same Goobi viewer platform, IIIF structure
- **GenericIiifLoader**: Standard IIIF v2 handling
- Pattern follows other Austrian libraries (OnbLoader for Vienna)

## Special Considerations
1. **No authentication required** - Public access
2. **High-resolution support** - Server supports up to 30000px width
3. **Stable IDs** - Numeric IDs are consistent
4. **Rich metadata** - Extensive scholarly information available
5. **CC License** - Most content under CC BY-SA 3.0 AT

## Recommended Implementation Priority
**HIGH** - This is a straightforward IIIF implementation with:
- Standard IIIF v2 compliance
- No authentication requirements
- Stable, well-structured URLs
- Good server performance
- Rich manuscript collection

## Next Steps
1. Create LinzLoader.ts following the GrazLoader pattern
2. Add URL detection for digi.landesbibliothek.at
3. Test with multiple manuscript types
4. Add to supported libraries list
5. Create unit tests for URL extraction and manifest parsing