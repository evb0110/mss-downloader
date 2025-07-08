# Belgica KBR Viewer Architecture Analysis

## Overview

The Royal Library of Belgium (KBR) uses a sophisticated digital manuscript viewing system accessible through their Belgica digital library platform. This analysis examines the viewer architecture, tile system implementation, and technical infrastructure.

## Viewer System Architecture

### Primary Access Points
- **Catalog Page**: `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415`
- **Digital Viewer**: `https://uurl.kbr.be/1558106` (Universal Uniform Resource Locator)
- **Gallery System**: `https://viewerd.kbr.be/gallery.php?map=A/1/6/1/6/9/3/0/BE-KBR00_A_1616930_0000_00_00_0001.jpg`

### Technical Implementation

#### XLimage Technology
- **Format**: XLimage® 2.0 zoomable image format
- **Developer**: Centrica (www.centrica.it) - Italian company
- **Architecture**: Standalone application server working with web server
- **Color Space**: YCbCr (CIR-601 standard compliant)
- **Features**: Interactive zoom, high color fidelity, copyright protection via digital watermarking

#### Viewer Components
```javascript
ComponentFactory.createInstance('DigitalReadyViewer', {
    el:'#dr-root-9aa305b88367487099e8dbf7b8243d45', 
    data: { 
        highlightTerms: '', 
        collectionId:'16994415', 
        documentId:'', 
        jsonData:'', 
        iiifUrl:'' 
    }
})
```

### URL Structure Analysis

#### Manuscript Identification
- **Pattern**: `http://uurl.kbr.be/{manuscript_id}`
- **Example**: `http://uurl.kbr.be/1496332` (ID: 1496332)
- **Mapping**: Links to gallery system with structured path

#### Gallery Path Structure
```
https://viewerd.kbr.be/gallery.php?map=A/1/7/3/0/1/7/7/BE-KBR00_A_1730177_0000_00_00_0001.jpg
```

## Tile System Implementation

### XLimage® 2.0 Specifications
- **Multiresolution Format**: Images stored in pyramid structure
- **Tile Organization**: Hierarchical tile system for efficient loading
- **Metadata Support**: XML catalogues with DIG35 standard compliance
- **Watermarking**: Patented algorithms from University of Florence DET

### Performance Characteristics
- **Loading Strategy**: Progressive tile loading for zoom levels
- **Color Accuracy**: Device-independent color space ensures fidelity
- **Copyright Protection**: Digital watermarking prevents unauthorized use

## Authentication and Access Control

### Current Limitations
- **Viewing Only**: Users can examine images in detail but cannot download
- **Copyright Restrictions**: Downloading disabled due to copyright concerns
- **Future Plans**: KBR intends to enable downloading in the future

### Technical Restrictions
- **External Tool Compatibility**: Limited compatibility with third-party tools like dezoomify
- **Access Control**: Viewer restricts direct tile access

## Digital Collection Context

### Collection Size
- **Manuscripts**: ~35,000 total, including 4,500 medieval codices
- **Old Books**: 300,000 dating from before 1830
- **Digitization Timeline**: 10+ years of ongoing digitization
- **Recent Addition**: 213 medieval manuscripts made available online

### Notable Collections
- Roman de Girart de Nevers
- Peterborough Psalter
- Chroniques de Hainaut

## Integration with Standards

### IIIF Compatibility
- **Current Status**: Limited IIIF implementation detected
- **iiifUrl Field**: Present in viewer configuration but may be empty
- **Future Potential**: Could be enhanced for better interoperability

### Metadata Standards
- **XML Compliance**: DIG35 standard for image metadata
- **Catalog Integration**: Searchable through Belgica platform
- **Identification**: Structured manuscript ID system

## Technical Challenges

### Third-Party Integration
- **Dezoomify Support**: Listed as supported but with known issues
- **API Access**: Limited programmatic access to tile system
- **Direct Downloads**: Intentionally restricted

### Performance Considerations
- **High-Resolution Images**: Efficient serving through tile system
- **Zoom Performance**: Optimized for interactive viewing
- **Server Load**: Distributed through CDN-like architecture

## Comparison with Common Viewers

### Versus OpenSeadragon
- **XLimage**: Proprietary format with built-in copyright protection
- **OpenSeadragon**: Open-source, supports multiple tile formats
- **Integration**: Could potentially be adapted for OpenSeadragon

### Versus IIIF Viewers
- **Standards Compliance**: Limited IIIF compatibility
- **Interoperability**: Restricted compared to full IIIF implementation
- **Access Control**: Enhanced protection vs. open access

## Recommendations for Integration

### For Download Applications
1. **Tile URL Pattern Discovery**: Reverse engineer XLimage tile structure
2. **Authentication Handling**: Implement session management
3. **Metadata Extraction**: Parse XML catalog information
4. **Quality Selection**: Identify maximum resolution parameters

### Technical Approach
1. **Session Analysis**: Study viewer network requests
2. **Tile Mapping**: Understand zoom level to tile relationship
3. **Format Conversion**: Handle XLimage to standard formats
4. **Rate Limiting**: Implement respectful download patterns

## Conclusion

The Belgica KBR viewer represents a sophisticated manuscript viewing system using proprietary XLimage technology. While it provides excellent viewing capabilities with copyright protection, it presents challenges for external integration due to its closed architecture. Understanding the tile system requires deeper technical analysis of the XLimage format and its implementation within KBR's digital infrastructure.

The system prioritizes content protection and viewing experience over interoperability, reflecting the institution's need to balance public access with copyright obligations for their extensive manuscript collections.