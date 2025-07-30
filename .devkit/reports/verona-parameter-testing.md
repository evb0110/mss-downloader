# Verona NBM Parameter Testing Analysis

**Date:** July 30, 2025  
**Base URL:** https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html  
**Objective:** Understand URL structure and parameter behavior for Verona NBM viewer

## Executive Summary

The initial URL pattern provided (`visualizza.html?codiceDigital=15&volume=1` with full path) **does not work** and returns 404 errors. However, through systematic testing, I discovered the **correct working URL patterns** and the complete manuscript access workflow.

## Key Findings

### 🚨 URL Pattern Issues Discovered

1. **BROKEN URL PATTERN:**
   - `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html?codiceDigital=X&volume=Y`
   - **Status:** Returns 404 - "pagina richiesta non è presente" (requested page is not present)

2. **WORKING URL PATTERNS:**
   - **Primary:** `https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=X&volume=Y`
   - **Alternative:** `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=X`
   - **Mirador Frame:** `https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/mirador.html?codiceDigital=X&volume=Y`

### 📊 Parameter Behavior Analysis

#### Codice Digital Parameter
- **Working Range:** 14, 15, 16 (confirmed)
- **Non-working:** 1, 50, 100, 999 (return HTTP 500 errors)
- **Pattern:** Very limited range of valid manuscript codes
- **Behavior:** Invalid codes cause server errors, not graceful degradation

#### Volume Parameter  
- **Working Range:** 0, 1, 2, 3, 10, 99 (very flexible)
- **Behavior:** Volume parameter appears to be ignored or highly permissive
- **Note:** Volume 2+ may not contain actual manuscript data for all codices

### 🎭 Mirador Integration Discovery

The viewer uses a **two-level architecture:**

1. **Primary Page:** `visualizza.html` - Main interface wrapper
2. **Embedded Viewer:** `mirador.html` - IIIF viewer in iframe
3. **Manifest Discovery:** JavaScript data extraction from mirador.html

#### Manifest URL Pattern
```
https://nbm.regione.veneto.it/documenti/mirador_json/manifest/{MANIFEST_ID}.json
```

#### Parameter to Manifest Mapping
| Codice Digital | Volume | Manuscript Title | Manifest ID | Pages |
|---------------|--------|------------------|-------------|-------|
| 14 | 1 | CVII (100)_1 | CVII1001 | 250 |
| 15 | 1 | LXXXIX (84)_1 | LXXXIX841 | 254 |
| 16 | 1 | CCXCVII (435)_1 | CCXCVII4351 | 310 |

## Technical Implementation Details

### Working URL Structures

1. **Viewer Interface URL:**
   ```
   https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital={CODICE}&volume={VOLUME}
   ```

2. **Mirador Frame URL (contains manifest data):**
   ```
   https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/mirador.html?codiceDigital={CODICE}&volume={VOLUME}
   ```

3. **Direct IIIF Manifest URLs:**
   ```
   https://nbm.regione.veneto.it/documenti/mirador_json/manifest/{MANIFEST_ID}.json
   ```

### Manifest Data Extraction

From `mirador.html`, manifest information is embedded in JavaScript:
```javascript
var data=[{
    "location":"Verona",
    "manifestUri":"documenti/mirador_json/manifest/LXXXIX841.json",
    "title":"LXXXIX (84)_1",
    "widgets":[{"width":400,"type":"imageView","height":300}]
}];
```

### Error Conditions Observed

1. **404 Errors:** Incorrect URL path structure
2. **500 Errors:** Invalid codiceDigital values
3. **Empty Responses:** Volume parameter mismatches (returns 200 but no manifest data)
4. **SSL Issues:** Certificate hostname mismatch requiring bypass

## Pattern Analysis Results

### URL Testing Results
- **Total URLs Tested:** 25+ variations
- **Working Patterns:** 3 distinct URL structures
- **Failed Patterns:** Original URL with full path structure
- **Valid Manuscripts:** 3 confirmed with full IIIF manifests

### Parameter Range Analysis
- **Codice Digital Range:** Very narrow (14-16 confirmed working)
- **Volume Flexibility:** High (0-99 accepted, but may not contain data)
- **Multi-volume Manuscripts:** Limited evidence of actual multi-volume content

## Recommendations for Manuscript Downloader

### 1. URL Pattern Implementation
- **Primary Pattern:** Use `/VisualizzaVolume/visualizza.html` (without `/Generale/BibliotecaDigitale/`)
- **Fallback Pattern:** Use `/Generale/BibliotecaDigitale/caricaVolumi.html?codice=X` format
- **Manifest Discovery:** Parse mirador.html for manifest URLs

### 2. Parameter Validation
- **Codice Digital:** Validate range (14-16 confirmed, may need dynamic discovery)
- **Volume Parameter:** Default to 1, but allow user override
- **Error Handling:** Implement 500 error detection for invalid codices

### 3. Manifest Processing
- **Direct Access:** Use discovered `nbm.regione.veneto.it` manifest URLs
- **IIIF Compliance:** All manifests are valid IIIF with 250+ pages
- **Caching:** Cache codice→manifest mappings for performance

### 4. Error Recovery
- **SSL Bypass:** Required for `nuovabibliotecamanoscritta.it` domain
- **Domain Fallback:** Use `nbm.regione.veneto.it` for manifest access
- **Timeout Handling:** Extended timeouts needed for large manifests (250+ pages)

### 5. User Interface Considerations
- **Parameter Discovery:** Implement dynamic codice discovery mechanism
- **Multi-volume Detection:** Check for actual content in volume 2+ before offering options
- **URL Validation:** Validate URLs before processing to detect pattern changes

## Discovered Manuscript Collection

The following manuscripts are confirmed working with full IIIF manifests:

1. **CVII (100)_1** - 250 pages
   - URL: `codiceDigital=14&volume=1`
   - Manifest: `CVII1001.json`

2. **LXXXIX (84)_1** - 254 pages  
   - URL: `codiceDigital=15&volume=1`
   - Manifest: `LXXXIX841.json`

3. **CCXCVII (435)_1** - 310 pages
   - URL: `codiceDigital=16&volume=1` 
   - Manifest: `CCXCVII4351.json`

## Technical Notes

### SSL Certificate Issues
- Domain `nuovabibliotecamanoscritta.it` has certificate hostname mismatch
- Requires `NODE_TLS_REJECT_UNAUTHORIZED=0` or similar SSL bypass
- Alternative domain `nbm.regione.veneto.it` has proper certificates

### Response Size Patterns
- **Working responses:** 13,999-14,005 bytes (viewer interfaces)
- **Mirador responses:** 1,448-1,454 bytes (with manifest data)
- **Error responses:** 11,601 bytes (500 errors), 50,391 bytes (404 errors)

### Performance Considerations
- **Manifest Size:** 250KB-315KB per manuscript (large JSON files)
- **Page Counts:** 250-310 pages per manuscript (substantial downloads)
- **Network Timeouts:** Extended timeouts required for initial manifest loading

## Future Investigation Recommendations

1. **Expand Codice Discovery:** Test broader ranges (1-100, 100-1000) to find all valid manuscripts
2. **Volume Content Verification:** Verify if volumes 2+ contain different content or are duplicates
3. **Metadata Extraction:** Parse manifest titles and descriptions for better user experience
4. **Performance Optimization:** Implement manifest caching and parallel page downloads
5. **Error Pattern Analysis:** Map specific error codes to user-friendly messages

## Files Generated
- `verona-test-results.json` - Initial parameter testing results  
- `verona-url-analysis.json` - URL pattern analysis
- `verona-parameter-analysis.json` - Parameter behavior analysis
- `verona-mirador-analysis.json` - Mirador integration and manifest discovery
- Sample response files for technical analysis

This analysis provides the foundation for implementing robust Verona NBM support in the manuscript downloader with proper error handling and parameter validation.