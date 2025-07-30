# Verona NBM Viewer Endpoint Test Report

**Test URL:** `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1`

**Date:** 2025-07-30

## HTTP Response Analysis

### Response Status
- **HTTP Status:** 404 NOT FOUND
- **Content-Type:** text/html; charset=utf-8
- **Server:** OPLON-ADC/10.12
- **Content-Length:** 50,391 bytes

### SSL Certificate Issues
- SSL certificate verification failed with "unable to get local issuer certificate"
- Connection requires bypassing SSL verification (-k flag)
- Base domain (https://www.nuovabibliotecamanoscritta.it/) is accessible with HTTP 200 status

## Page Content Analysis

### Error Message
The endpoint returns a standard 404 error page with Italian content:
- **Title:** "Regione Veneto" 
- **Error Message:** "Contenuto non trovato" (Content not found)
- **Description:** "Ci scusiamo per il disagio, la pagina richiesta non è presente" (We apologize for the inconvenience, the requested page is not present)
- **Redirect Link:** Points to http://www.regione.veneto.it (Veneto Region homepage)

### HTML Structure
- Standard XHTML 1.0 Strict DOCTYPE
- Basic HTML structure with CSS reset styles
- No JavaScript libraries detected
- No viewer components (OpenSeadragon, Leaflet, etc.)
- No IIIF manifest references
- No manuscript viewer interface elements

### Technical Observations
- The error page is served by the Regione Veneto (Veneto Region) infrastructure
- Server uses OPLON-ADC technology stack
- No authentication requirements detected - direct 404 response
- No redirects observed - endpoint directly returns 404

## Key Findings

1. **Endpoint Status:** INACTIVE - The specific viewer URL does not exist
2. **Infrastructure:** Base domain is functional but the manuscript viewer path is invalid
3. **Error Handling:** Standard regional government 404 page, not library-specific
4. **SSL Configuration:** Certificate issues may indicate infrastructure problems
5. **No Viewer Technology:** No evidence of IIIF, DZI, or other manuscript viewer technologies

## Implications for MSS Downloader

- This specific endpoint cannot be used for manuscript downloading
- The URL pattern `/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html` may be outdated or incorrect
- Alternative endpoint discovery needed for Verona NBM integration
- Base domain accessibility suggests the service may exist under different paths

## Recommendations

1. **URL Pattern Investigation:** Search for current Verona NBM viewer URLs
2. **Alternative Endpoints:** Check for different path structures or subdomains
3. **Documentation Review:** Look for updated API documentation or viewer interfaces
4. **Network Analysis:** Test different codiceDigital/volume parameter combinations
5. **Website Navigation:** Manually explore the base site to find active manuscript viewer