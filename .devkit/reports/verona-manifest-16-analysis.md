# Verona NBM IIIF Manifest Analysis - ID 16

**Date**: 2025-07-30  
**Target URL**: https://nbm.regione.veneto.it/documenti/mirador_json/manifest/16.json  
**Status**: **INACCESSIBLE**

## Executive Summary

The specified IIIF manifest URL for Verona NBM (Nuova Biblioteca Manoscritta) manuscript ID 16 is currently inaccessible. All attempts to retrieve the JSON manifest resulted in HTML error pages from the Regione Veneto website instead of the expected IIIF manifest data.

## Investigation Results

### 1. Direct Access Attempts

**Primary URL**: `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/16.json`
- **Result**: Returns HTML error page from Regione Veneto website
- **Status Code**: 200 (but wrong content type)
- **Content**: HTML page with DOCTYPE and CSS, not JSON

### 2. Alternative URL Patterns Tested

All following patterns returned the same HTML error page:
- `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/16/manifest.json`
- `https://nbm.regione.veneto.it/manifests/16.json`
- `https://nbm.regione.veneto.it/iiif/16/manifest.json`

### 3. Headers and Authentication Attempts

Tested various HTTP headers and authentication approaches:
- User-Agent: Mozilla browser strings
- Accept: application/json, */*
- Referer: https://nbm.regione.veneto.it/
- Accept-Language: it-IT,it;q=0.9
- Session cookies and cache control
- SSL certificate bypass (-k flag)

**All attempts resulted in the same HTML error page.**

## NBM System Analysis

### Project Context
- **NBM**: Nuova Biblioteca Manoscritta (New Manuscript Library)
- **Scope**: Regional project by Regione del Veneto cataloging manuscripts across Veneto libraries
- **Launch**: 2003
- **Coverage**: Multiple libraries including Verona institutions

### Participating Verona Libraries
1. Biblioteca alle Stimate
2. Biblioteca capitolare  
3. Biblioteca civica
4. Biblioteca d'Arte del Museo di Castelvecchio
5. Biblioteca dell'Accademia di Agricoltura
6. Biblioteca del Museo civico di storia naturale

### Technical Infrastructure Issues

**Identified Problems:**
1. **URL Structure Mismatch**: The requested URL pattern may not match the actual implementation
2. **Authentication Requirements**: The system may require session authentication or special tokens
3. **Service Availability**: The IIIF endpoint may be temporarily or permanently unavailable
4. **Network Restrictions**: Geographic or institutional access restrictions may apply

## IIIF Compliance Assessment

**Status**: **UNABLE TO DETERMINE**
- Cannot assess IIIF version (2.x vs 3.x) without manifest access
- Cannot analyze canvas structure or image service patterns
- Cannot test resolution parameters or image URLs
- Cannot verify authentication requirements

## Recommendations for Implementation

### Immediate Actions Needed

1. **Contact NBM System Administrators**
   - Verify correct manifest URL patterns
   - Confirm public access availability
   - Request API documentation

2. **Alternative Access Methods**
   - Check if manuscript viewer pages contain embedded manifest data
   - Look for JavaScript-based manifest loading
   - Investigate institutional API access

3. **URL Pattern Investigation**
   - Test manuscript IDs other than 16
   - Check for different base URL structures
   - Verify current system status

### Implementation Strategy

Until manifest access is resolved:
1. **Monitor System Status**: Regularly check URL accessibility
2. **Document Requirements**: Create specification for NBM integration
3. **Fallback Options**: Consider alternative Verona manuscript sources

## Technical Analysis - Hypothetical Structure

Based on standard IIIF practices, if accessible, the manifest would likely contain:

### Expected IIIF Structure
```json
{
  "@context": "http://iiif.io/api/presentation/[2|3]/context.json",
  "@id": "https://nbm.regione.veneto.it/documenti/mirador_json/manifest/16.json",
  "@type": "sc:Manifest",
  "label": "[Manuscript Title]",
  "sequences": [...],
  "canvases": [...]
}
```

### Typical Resolution Parameters to Test
- `full/full` - Maximum available resolution
- `full/max` - Server-defined maximum
- `full/2000` - 2000px width
- `full/4000` - 4000px width
- `full/!2000,2000` - Fit within 2000x2000

## File Organization

**Report Location**: `.devkit/reports/verona-manifest-16-analysis.md`  
**Status**: Investigation complete, manifest inaccessible
**Next Steps**: Await system resolution or alternative access method

## Conclusion

The Verona NBM IIIF manifest at the specified URL is currently inaccessible due to what appears to be a system configuration issue or access restriction. The URL returns HTML error pages instead of JSON manifest data, preventing any technical analysis of IIIF compliance, image service patterns, or resolution testing.

**Recommendation**: Contact NBM system administrators or explore alternative manuscript sources for Verona collections until this technical issue is resolved.

---
*Analysis performed silently with comprehensive URL testing and NBM system research.*