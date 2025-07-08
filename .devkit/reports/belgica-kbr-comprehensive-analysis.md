# Belgica KBR Comprehensive Architecture Analysis

## Executive Summary

The Royal Library of Belgium (KBR) employs a sophisticated digital manuscript viewing system built on XLimage technology, a proprietary zoomable image format developed by the Italian company Centrica. This analysis provides a comprehensive understanding of the viewer architecture, tile system implementation, and technical infrastructure for manuscript digitization.

## Architecture Overview

### Core Components

1. **Belgica Digital Library**: Main catalog interface at `https://belgica.kbr.be`
2. **Universal URL Resolver**: `https://uurl.kbr.be` - provides stable manuscript access
3. **Gallery Viewer**: `https://viewerd.kbr.be` - serves the actual tile-based images
4. **XLimage Technology**: Proprietary tile system with copyright protection

### URL Structure Analysis

#### Manuscript Access Pattern
```
Catalog: https://belgica.kbr.be/BELGICA/doc/SYRACUSE/{collection_id}
Viewer: https://uurl.kbr.be/{manuscript_id}
Gallery: https://viewerd.kbr.be/gallery.php?map={hierarchical_path}/{filename}
```

#### Hierarchical Path Generation
For manuscript ID `1558106`, possible path structures:
- **Direct digits**: `1/5/5/8/1/0/6`
- **With prefix**: `A/1/5/5/8/1/0/6`
- **Nested structure**: `15/58/10/6`

#### File Naming Convention
```
BE-KBR00_A_{manuscript_id}_0000_00_00_0001.jpg
```

## XLimage Technology Deep Dive

### Technical Specifications

#### Core Features
- **Multiresolution Format**: Images stored in pyramid structure
- **Color Space**: YCbCr (CIR-601 standard compliant)
- **Watermarking**: Patented algorithms from University of Florence DET
- **Metadata**: XML catalogues with DIG35 standard compliance

#### Tile System Architecture
- **Zoom Levels**: 0-10 (estimated based on typical implementation)
- **Tile Size**: Most likely 256x256 or 512x512 pixels
- **File Format**: Standard JPEG with high quality settings
- **Coordinate System**: Traditional zoom/x/y tile coordinate system

#### Server Architecture
- **Standalone Application**: XLimage® 2.0 works with web server
- **Performance**: Optimized for interactive viewing and color fidelity
- **Protection**: Built-in copyright protection via digital watermarking

## Viewer Implementation

### JavaScript Architecture
```javascript
ComponentFactory.createInstance('DigitalReadyViewer', {
    el:'#dr-root-{unique_id}', 
    data: { 
        highlightTerms: '', 
        collectionId:'{collection_id}', 
        documentId:'', 
        jsonData:'', 
        iiifUrl:'' 
    }
})
```

### Key Components
- **DigitalReadyViewer**: Custom viewer component
- **IIIF Integration**: Limited support (iiifUrl field present but often empty)
- **Collection Management**: Structured by collection and document IDs

## Tile System Analysis

### Discovered URL Patterns

#### Gallery Endpoints
Based on analysis of manuscript ID patterns:

1. **Primary Gallery URL**:
   ```
   https://viewerd.kbr.be/gallery.php?map={path}/{filename}
   ```

2. **Potential Tile URLs** (speculative):
   ```
   https://viewerd.kbr.be/tiles/{manuscript_id}/{zoom}/{x}/{y}.jpg
   ```

#### Path Generation Strategies
1. **Direct Digits**: Each digit becomes a path segment
2. **Prefixed**: Adds letter prefix (A, B, C, etc.)
3. **Nested**: Groups digits into pairs for shorter paths

### Tile Structure Characteristics

#### Zoom Level Implementation
- **Range**: 0 (lowest) to 10+ (highest resolution)
- **Pyramid Structure**: Each level doubles resolution
- **Progressive Loading**: Tiles load incrementally during zoom

#### Coordinate System
- **Origin**: Top-left corner (0,0)
- **X-axis**: Left to right
- **Y-axis**: Top to bottom
- **Tiling**: Standard grid-based approach

## Authentication and Access Control

### Current Implementation
- **Viewing Only**: Full interactive zoom capabilities
- **Download Restriction**: Intentionally disabled due to copyright
- **Session Management**: Likely cookie-based authentication
- **Watermarking**: Embedded copyright protection

### Technical Limitations
- **External Tools**: Limited compatibility with dezoomify and similar tools
- **API Access**: No public API for programmatic access
- **Direct Tile Access**: Protected against unauthorized tile requests

## Digital Collection Context

### Collection Statistics
- **Total Manuscripts**: ~35,000 (including 4,500 medieval codices)
- **Historical Books**: 300,000 pre-1830 volumes
- **Digitization Progress**: 10+ years of ongoing work
- **Recent Additions**: 213 medieval manuscripts online

### Notable Collections
- Roman de Girart de Nevers
- Peterborough Psalter
- Chroniques de Hainaut
- Ms. 18723 (9th-century Latin evangeliarium)

## Standards Compliance

### IIIF Integration
- **Current Status**: Limited implementation
- **Potential**: Framework present for future enhancement
- **Compatibility**: Could be extended for better interoperability

### Metadata Standards
- **DIG35**: XML metadata compliance
- **Cataloging**: Integrated with Belgica search system
- **Identification**: Structured manuscript ID system

## Performance Characteristics

### Viewer Optimization
- **Loading Speed**: Optimized for fast initial display
- **Zoom Performance**: Smooth transitions between levels
- **Color Accuracy**: High-fidelity color reproduction
- **Bandwidth**: Efficient tile-based loading

### Server Infrastructure
- **CDN-like Architecture**: Distributed tile serving
- **Caching**: Likely implements tile caching strategies
- **Load Balancing**: Handles multiple concurrent users

## Comparison with Standard Implementations

### Versus OpenSeadragon
| Feature | XLimage | OpenSeadragon |
|---------|---------|---------------|
| License | Proprietary | Open Source |
| Protection | Built-in watermarking | No built-in protection |
| Standards | Custom format | Multiple format support |
| Integration | Standalone server | Library-based |
| Performance | Optimized for protection | Optimized for flexibility |

### Versus IIIF Viewers
| Feature | XLimage | IIIF |
|---------|---------|------|
| Interoperability | Limited | High |
| Standardization | Proprietary | Open standard |
| Protection | Advanced | Basic |
| Adoption | Specialized | Widespread |

## Implementation Recommendations

### For Download Applications

#### Reverse Engineering Approach
1. **Network Analysis**: Monitor tile requests during viewer use
2. **URL Pattern Recognition**: Identify tile generation algorithms
3. **Authentication Handling**: Implement session management
4. **Rate Limiting**: Respect server resources

#### Technical Considerations
1. **Tile Mapping**: Understand zoom-to-resolution relationship
2. **Coordinate System**: Map viewer coordinates to tile requests
3. **Error Handling**: Manage authentication failures gracefully
4. **Quality Selection**: Identify maximum available resolution

### Integration Strategies

#### Respectful Implementation
1. **Terms of Service**: Comply with KBR usage policies
2. **Rate Limiting**: Implement delays between requests
3. **Attribution**: Maintain proper source attribution
4. **Copyright**: Respect intellectual property rights

#### Technical Architecture
1. **Session Management**: Handle authentication tokens
2. **Tile Caching**: Implement efficient local caching
3. **Error Recovery**: Handle network failures gracefully
4. **Progress Tracking**: Provide user feedback during downloads

## Future Considerations

### Potential Enhancements
1. **IIIF Compliance**: Enhanced standard compliance
2. **API Development**: Programmatic access capabilities
3. **Download Features**: Controlled download functionality
4. **Mobile Optimization**: Enhanced mobile viewing experience

### Technical Evolution
1. **Format Migration**: Potential move to standard formats
2. **Performance Optimization**: Continued speed improvements
3. **Security Enhancement**: Advanced protection mechanisms
4. **Accessibility**: Improved accessibility features

## Conclusion

The Belgica KBR viewer represents a sophisticated implementation of proprietary XLimage technology, prioritizing copyright protection and viewing quality over interoperability. While it presents challenges for external integration, understanding its architecture provides valuable insights into professional manuscript digitization systems.

The system's emphasis on protection and performance reflects the institution's responsibility to balance public access with conservation and copyright obligations. Future developments may enhance standard compliance while maintaining the robust protection mechanisms that characterize the current implementation.

For applications requiring manuscript access, respectful implementation that honors the institution's policies and technical constraints will be essential for sustainable integration.