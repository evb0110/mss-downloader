# Manchester Digital Collections Library Analysis

## Overview
Manchester Digital Collections (digitalcollections.manchester.ac.uk) provides access to medieval manuscripts from the John Rylands Library with full IIIF support.

## URL Pattern Analysis
**Base URL Pattern**: `https://www.digitalcollections.manchester.ac.uk/view/{MANUSCRIPT_ID}/{PAGE_NUMBER}`

**Examples**:
- `https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1`
- `https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00136/1`
- `https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00011/1`

**Regex Pattern**: `/\/view\/([^\/]+)\/(\d+)/`

## IIIF Implementation Details

### Manifest Endpoint
**URL**: `https://www.digitalcollections.manchester.ac.uk/iiif/{MANUSCRIPT_ID}`
**Format**: IIIF Presentation API 2.0
**Example**: `https://www.digitalcollections.manchester.ac.uk/iiif/MS-LATIN-00074`

### Image Service
**Base URL**: `https://image.digitalcollections.manchester.ac.uk/iiif/{IMAGE_ID}`
**API Version**: IIIF Image API 2.0 Level 1
**Server**: IIPImage (Apache-based)

### Resolution Testing Results

#### Available Resolution Parameters
- `full/full/0/default.jpg` - Original full resolution
- `full/max/0/default.jpg` - Maximum available resolution (same as full)
- `full/2000,/0/default.jpg` - Width constrained to 2000px
- `full/4000,/0/default.jpg` - Width constrained to 4000px
- `full/6000,/0/default.jpg` - Width constrained to 6000px

#### Maximum Resolution Discovered
- **Typical dimensions**: 4000-6000px width × 6500px height
- **Highest found**: 5906 × 6500 pixels (MS-LATIN-00136)
- **File format**: JPEG (from JP2 source)
- **Quality**: High resolution, suitable for scholarly use

## Manuscript Analysis

### MS-LATIN-00074 (Antiphoner)
- **Pages**: 539 canvases
- **Origin**: Rome, c. 1264
- **Resolution**: Up to 5600px height
- **Content**: Complete antiphoner with musical notation

### MS-LATIN-00136 (Breviary)
- **Pages**: 178 canvases
- **Origin**: Paris, early 15th century
- **Resolution**: 5906 × 6500 pixels (maximum found)
- **Content**: Illuminated breviary with kalendar

### MS-LATIN-00011 (Manuscript)
- **Pages**: Multiple canvases
- **Resolution**: 4973 × 6500 pixels
- **Verified**: Image accessibility confirmed via HTTP HEAD requests

### MS-LATIN-00022 (Psalter of Joan of Navarre)
- **Pages**: 169 leaves
- **Origin**: Paris, 1220-1230
- **Content**: Extensively illuminated psalter with 179 historiated initials

### MS-LATIN-00088 (Gospel Book)
- **Pages**: 161 folios
- **Origin**: Lower Saxony, Germany, 12th century
- **Content**: Four Gospels with evangelist portraits

### MS-LATIN-00098 (Ottonian Gospel Book)
- **Pages**: 205 folios
- **Origin**: Trier, Germany, 996-1002
- **Content**: Elaborately decorated Gospel book for Otto III

## Technical Implementation Requirements

### Authentication
- **Required**: None
- **Access**: Public IIIF endpoints
- **CORS**: Enabled (Access-Control-Allow-Origin: *)

### Rate Limiting
- **Recommended**: 1-2 seconds between requests
- **Server**: Apache/2.4.18 with IIPImage
- **Caching**: Max-age 86400 (24 hours)

### Image Processing
- **Source Format**: JP2 (JPEG2000)
- **Output Format**: JPEG
- **Quality**: Lossless conversion from JP2
- **Metadata**: Preserved in IIIF manifest

## Implementation Code Structure

```javascript
// URL pattern matching
const urlPattern = /https:\/\/www\.digitalcollections\.manchester\.ac\.uk\/view\/([^\/]+)\/(\d+)/;

// Extract manuscript ID
const match = url.match(urlPattern);
const manuscriptId = match[1];

// Fetch IIIF manifest
const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
const manifest = await fetch(manifestUrl).then(r => r.json());

// Extract image URLs
const canvases = manifest.sequences[0].canvases;
const imageUrls = canvases.map(canvas => {
    const serviceId = canvas.images[0].resource.service["@id"];
    const imageId = serviceId.replace("https://image.digitalcollections.manchester.ac.uk/iiif/", "");
    return `https://image.digitalcollections.manchester.ac.uk/iiif/${imageId}/full/max/0/default.jpg`;
});
```

## Quality Assessment

### Pros
- **Full IIIF compliance**: Standard implementation
- **High resolution**: 4000-6500px images
- **No authentication**: Public access
- **Stable platform**: Apache/IIPImage infrastructure
- **Rich metadata**: Comprehensive manuscript descriptions
- **CORS enabled**: Cross-origin requests supported

### Cons
- **Rate limiting needed**: Server performance considerations
- **Large file sizes**: High resolution images require bandwidth
- **JP2 processing**: Server-side conversion may cause delays

## Implementation Recommendations

### Priority: HIGH
**Reasons**:
1. Standard IIIF implementation (easy integration)
2. High-quality manuscript images
3. Significant collection (John Rylands Library)
4. No authentication barriers
5. Stable, well-maintained platform

### Implementation Steps
1. Add URL pattern recognition for Manchester Digital Collections
2. Implement IIIF manifest fetching
3. Parse manifest structure for image service URLs
4. Add rate limiting (1-2 seconds between requests)
5. Test with various manuscript types (antiphoners, psalters, gospel books)
6. Validate image quality and resolution

### Estimated Implementation Time
**4-6 hours** including testing and validation

### Test Cases Required
- Large manuscripts (500+ pages like MS-LATIN-00074)
- Medium manuscripts (100-200 pages)
- Various manuscript types (liturgical, biblical, historical)
- Different time periods (12th-15th centuries)
- Different origins (Rome, Paris, Germany)

## Conclusion

Manchester Digital Collections is an excellent candidate for implementation due to:
- **Standard IIIF compliance**: Reduces development complexity
- **High-quality images**: Meets scholarly requirements
- **Stable infrastructure**: Reliable downloads
- **Rich collection**: Valuable medieval manuscripts
- **No authentication barriers**: Immediate access

The implementation should be straightforward following standard IIIF patterns already used in the application.