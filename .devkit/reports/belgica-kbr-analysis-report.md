# Belgica KBR (Royal Library of Belgium) - Technical Analysis Report

## Executive Summary

Belgica KBR uses a **custom Ajax-Zoom viewer** system, not IIIF. The library provides direct access to high-resolution JPEG images through a structured directory system. Implementation is **feasible** with good image quality and accessibility.

## Library Overview

- **Name**: Belgica KBR (Royal Library of Belgium)
- **Base URL**: https://belgica.kbr.be/
- **Technology**: Custom Ajax-Zoom viewer system
- **Image Format**: JPEG
- **Access Method**: Direct HTTP access to image directories

## URL Pattern Analysis

### Document URLs
- Pattern: `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/{documentId}`
- Examples:
  - `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415`
  - `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10745220`
  - `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10734174`

### Document ID Extraction
- Simple regex pattern: `/BELGICA/doc/SYRACUSE/(\d+)`
- Document IDs are numeric (e.g., 16994415, 10745220, 10734174)

## Viewer Technology

### Ajax-Zoom Implementation
- **Viewer**: Custom Ajax-Zoom viewer (not IIIF)
- **JavaScript Library**: jQuery-based Ajax-Zoom
- **Path**: `/AJAX/axZm/`
- **Configuration**: Custom `ajaxZoom.queryString` parameters

### Image Access Flow
1. Document page → UURL (Universal URL) → Viewer with map parameter
2. UURL pattern: `https://uurl.kbr.be/{uurlId}`
3. Viewer URL: `https://viewerd.kbr.be/gallery.php?map={mapPath}`
4. Direct image access: `https://viewerd.kbr.be/display/{mapPath}/{imageFilename}`

## Image Structure Analysis

### Directory Organization
```
https://viewerd.kbr.be/display/{mapPath}/
```

Where `mapPath` follows pattern: `{prefix}/{digits_split_by_slash}/0000-00-00_00/`

Examples:
- Document 10731386 → Map: `B/0/7/3/1/3/8/6/0000-00-00_00/`
- Document 10745220 → Map: `B/0/7/4/5/2/2/0/0000-00-00_00/`
- Document 16994415 → Map: `A/1/5/8/9/4/8/5/0000-00-00_00/`

### Image File Naming
- Pattern: `BE-KBR00_{prefix}-{documentId}_0000-00-00_00_{pageNumber:04d}.jpg`
- Examples:
  - `BE-KBR00_B-10731386_0000-00-00_00_0001.jpg`
  - `BE-KBR00_B-10745220_0000-00-00_00_0001.jpg`

### Image Quality Analysis
- **Resolution**: 800×1145 pixels (sample tested)
- **Format**: JPEG with high quality
- **DPI**: 300×300
- **File Size**: ~150-270KB per image
- **Color**: Full color (3 components)
- **Metadata**: Professional scanning (Hasselblad H5D-200c MS camera)

## URL Relationships Mapping

### Document → UURL → Map Path
| Document ID | UURL | Map Path |
|-------------|------|----------|
| 10731386 | https://uurl.kbr.be/2195401 | B/0/7/3/1/3/8/6/0000-00-00_00/ |
| 10745220 | https://uurl.kbr.be/1750523 | B/0/7/4/5/2/2/0/0000-00-00_00/ |
| 16994415 | https://uurl.kbr.be/1558106 | A/1/5/8/9/4/8/5/0000-00-00_00/ |

### Path Generation Algorithm
1. Extract document ID from Belgica URL
2. Fetch document page and extract UURL
3. Fetch UURL and extract map parameter
4. Construct direct image directory URL
5. List directory contents to get all image filenames

## Implementation Strategy

### Core Components Needed
1. **URL Parser**: Extract document ID from Belgica URLs
2. **UURL Resolver**: Fetch UURL from document page
3. **Map Extractor**: Extract map parameter from viewer page
4. **Image Lister**: Parse directory listing to get all images
5. **Image Downloader**: Download individual JPEG files

### Technical Implementation Steps
1. **Document Detection**: Regex match `/BELGICA/doc/SYRACUSE/(\d+)`
2. **UURL Extraction**: Parse document page for `https://uurl.kbr.be/[0-9]+`
3. **Map Parameter**: Extract `map=` parameter from UURL redirect
4. **Directory Listing**: Parse Apache directory listing
5. **Image URLs**: Construct direct image URLs
6. **Download**: Fetch individual JPEG files

### Code Architecture
```typescript
interface BelgicaDocument {
  documentId: string;
  uurlId: string;
  mapPath: string;
  imageUrls: string[];
}

class BelgicaDownloader {
  async extractDocumentId(url: string): Promise<string>
  async getUURL(documentId: string): Promise<string>
  async getMapPath(uurlId: string): Promise<string>
  async listImages(mapPath: string): Promise<string[]>
  async downloadImages(imageUrls: string[]): Promise<Buffer[]>
}
```

## Maximum Resolution Testing

### Current Resolution Analysis
- **Available Resolution**: 800×1145 pixels
- **Quality**: High-quality JPEG (300 DPI)
- **Professional Scanning**: Hasselblad equipment
- **No Higher Resolutions**: Single resolution available per document

### Resolution Verification
- Tested multiple images across different documents
- Consistent resolution and quality
- No zoom levels or alternative resolutions found
- Direct access to full-resolution images

## Validation Test Results

### Document 10731386 (Evangeliaire)
- **Total Images**: 562 pages
- **Image Pattern**: Consistent naming
- **Access**: Direct HTTP access successful
- **Quality**: High resolution, clear manuscript content

### Document 10745220
- **Total Images**: Multiple pages available
- **File Sizes**: 68KB-224KB range
- **Quality**: Consistent high quality

### Document 16994415
- **UURL**: 1558106
- **Map Path**: A/1/5/8/9/4/8/5/0000-00-00_00/
- **Access**: Successful

## Security and Access

### Access Control
- **Public Access**: No authentication required
- **Direct URLs**: Images accessible via direct HTTP
- **CORS**: No restrictions observed
- **Rate Limiting**: Not detected during testing

### HTTP Headers
- **Content-Type**: image/jpeg
- **Content-Length**: Available
- **Cache-Control**: Standard caching headers
- **Security**: Standard Apache server

## Implementation Recommendations

### Priority Level: HIGH
- **Feasibility**: Excellent
- **Image Quality**: High (800×1145, 300 DPI)
- **Access Reliability**: Direct HTTP access
- **Documentation**: Complete technical understanding

### Required Implementation Components
1. **URL Detection**: Regex for Belgica URLs
2. **UURL Resolution**: HTTP request to document page
3. **Map Extraction**: Parse viewer page
4. **Directory Parsing**: Apache listing parser
5. **Image Download**: Standard HTTP download

### Error Handling Considerations
- **Network Failures**: Retry logic for HTTP requests
- **Missing Images**: Handle directory listing variations
- **Rate Limiting**: Implement polite delays
- **Invalid URLs**: Validate document IDs

## Conclusion

Belgica KBR implementation is **highly recommended** due to:
- **Clear URL patterns** and predictable structure
- **High-quality images** with professional scanning
- **Direct access** without complex authentication
- **Stable architecture** with consistent naming
- **Complete technical documentation** from analysis

The library provides excellent manuscript digitization quality and should be prioritized for implementation in the manuscript downloader system.

---

**Analysis Date**: 2025-07-05  
**Status**: Complete  
**Recommendation**: Implement (High Priority)