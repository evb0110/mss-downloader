# MDC Catalonia (Memòria Digital de Catalunya) Analysis Report

## Executive Summary
MDC Catalonia is a sophisticated digital manuscript platform built on CONTENTdm with full IIIF (International Image Interoperability Framework) support. The platform provides access to historical manuscripts, particularly incunables from the Biblioteca de Catalunya, with comprehensive metadata and high-resolution imaging capabilities.

## Platform Architecture

### Core Technology Stack
- **Platform**: CONTENTdm Digital Collection Management System
- **Image Server**: CONTENTdm IIIF Image API (server21058.contentdm.oclc.org:8888)
- **Public Base URL**: https://mdc.csuc.cat
- **IIIF Compliance**: Level 2 (Full feature set)

### IIIF Implementation Details
- **Base IIIF Endpoint**: `https://mdc.csuc.cat/iiif/2/`
- **Image Identifier Pattern**: `{collection}:{itemId}`
- **Supported Formats**: TIF, JPG, GIF, PNG
- **Quality Levels**: bitonal, default, grayscale, color
- **Max Resolution**: Up to 2,540,640 pixels (varies by image)

## URL Structure Analysis

### Standard URL Pattern
```
https://mdc.csuc.cat/digital/collection/{collection}/id/{itemId}/rec/{pageNumber}
```

### Analyzed Collections
- **Collection**: `incunableBC` (Incunables - Biblioteca de Catalunya)
- **Sample Items**:
  - ID 175331: 200+ pages manuscript
  - ID 49455: 330+ pages manuscript (1485 ecclesiastical missal)
  - ID 14914: 266+ pages manuscript (1498 Missale Barcinonense)

### Page Navigation System
- **Format**: Sequential page numbering with Roman numerals
- **Examples**: `f. 1r`, `f. 1v`, `f. 2r`, `f. LXXIr`, `f. LXXXVIIIr`
- **Structure**: Compound objects with hierarchical page organization

## Image Access Methods

### IIIF API Endpoints
1. **Image Info**: `/{collection}:{itemId}/info.json`
2. **Full Image**: `/{collection}:{itemId}/full/730,/0/default.jpg`
3. **Custom Size**: `/{collection}:{itemId}/full/{width},/0/default.jpg`
4. **Thumbnail**: `/api/singleitem/collection/{collection}/id/{itemId}/thumbnail`

### Resolution Testing Results
- **Available Sizes**: 119x168, 237x335, 474x670, 948x1340 pixels
- **Tile Support**: 512x512 pixel tiles
- **Maximum Quality**: Original TIFF at 300 DPI preserved
- **Display Resolution**: Typically 150 PPI for web viewing

## Metadata Structure

### Multilingual Support
- **Languages**: Catalan (ca), Spanish (es), English (en-US)
- **Primary Language**: Catalan
- **Metadata Fields**: title, creator, date, language, rights, source, subject

### Rights Management
- **Status**: Public Domain ("Domini públic")
- **License**: Creative Commons licensing
- **Access**: Full public access to high-resolution images

## Technical Implementation Assessment

### Complexity Level: **Medium**
- **Pros**: Standard IIIF implementation, well-documented API
- **Cons**: Compound object structure requires page enumeration

### Required Implementation Components

1. **URL Pattern Detection**
   ```javascript
   const MDC_PATTERN = /mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)/;
   ```

2. **Page Discovery Method**
   - Parse compound object structure from initial page
   - Extract total page count from metadata
   - Generate sequential page URLs

3. **Image Extraction Strategy**
   ```javascript
   const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/full/0/default.jpg`;
   ```

4. **Maximum Resolution Detection**
   - Query info.json for dimensions
   - Test multiple resolution parameters
   - Select highest available quality

## Development Recommendations

### Priority: **High**
This library should be implemented due to:
- Excellent IIIF standard compliance
- High-quality manuscript digitization
- Comprehensive metadata
- Stable platform architecture
- Public domain content

### Implementation Steps

1. **Phase 1**: Basic URL detection and parsing
2. **Phase 2**: IIIF API integration with info.json queries
3. **Phase 3**: Compound object navigation and page enumeration
4. **Phase 4**: Maximum resolution testing and optimization
5. **Phase 5**: Metadata extraction and integration

### Testing Requirements

1. **Multi-Document Validation**
   - Test various manuscript collections
   - Verify page counting accuracy
   - Validate image quality consistency

2. **Resolution Testing**
   - Test all available IIIF size parameters
   - Compare quality vs. file size
   - Ensure maximum resolution extraction

3. **Error Handling**
   - Handle missing pages gracefully
   - Validate compound object structure
   - Implement retry mechanisms for API calls

## Technical Specifications

### API Endpoints Summary
- **Base URL**: `https://mdc.csuc.cat`
- **IIIF Base**: `/iiif/2/`
- **Metadata API**: `/api/singleitem/collection/{collection}/id/{itemId}/thumbnail`
- **Download API**: `/digital/api/collection/{collection}/id/{itemId}/download`

### Image Quality Matrix
| Size | Dimensions | Use Case |
|------|------------|----------|
| Thumbnail | 119x168 | Preview |
| Small | 237x335 | Mobile viewing |
| Medium | 474x670 | Web viewing |
| Large | 948x1340 | High-quality viewing |
| Full | Variable | Maximum quality |

### Expected Implementation Effort
- **Development Time**: 2-3 days
- **Testing Time**: 1-2 days
- **Documentation**: 1 day
- **Total**: 4-6 days

## Conclusion

MDC Catalonia represents an excellent implementation target with its robust IIIF support, comprehensive manuscript collections, and stable platform architecture. The standardized API and clear documentation make it a priority addition to the manuscript downloader library support.

The platform's focus on historical Catalan manuscripts, particularly incunables, provides valuable academic and research resources that would benefit from integrated download capabilities.