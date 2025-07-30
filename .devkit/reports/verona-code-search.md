# Verona/NBM Code Search Results

## Overview
Comprehensive search findings for "verona", "nbm", and related terms across the codebase. The Verona library implementation is extensive and well-integrated throughout the application.

## Core Implementation Files

### 1. SharedManifestLoaders.js
**File:** `/Users/evb/WebstormProjects/mss-downloader/src/shared/SharedManifestLoaders.js`

**Key Components:**
- **Lines 17-18:** Verona domain detection for retry logic
- **Lines 29-32:** Enhanced error messages for Verona timeouts
- **Lines 37-39:** Exponential backoff with jitter for Verona domains
- **Lines 138, 194:** Extended timeout configuration
- **Lines 241-532:** Complete Verona implementation including:
  - `getVeronaManifest()` method (main entry point)
  - `discoverVeronaManifestUrl()` for HTML parsing
  - `checkVeronaServerHealth()` for server status
  - `fetchVeronaIIIFManifest()` for IIIF processing

**URL Patterns Supported:**
```javascript
// Domain detection
url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')

// Direct IIIF manifest URLs
https://nbm.regione.veneto.it/documenti/mirador_json/manifest/{ID}.json

// Viewer interface URLs
https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice={ID}
https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital={ID}&volume=1
```

**Manifest ID Mappings (Lines 297-300):**
```javascript
const knownMappings = {
    '15': 'LXXXIX841',  // LXXXIX (84)
    '14': 'CVII1001'    // CVII (100)
};
```

### 2. EnhancedManuscriptDownloaderService.ts
**File:** `/Users/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts`

**Configuration (Lines 315-317):**
```typescript
{
    name: 'Verona Library (NBM)',
    key: 'verona',
    description: 'Nuova Biblioteca Manoscritta (Verona) manuscripts via IIIF',
    example: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
}
```

**Library Detection (Line 521):**
```typescript
if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
```

**Special Handling:**
- **Lines 764-789:** SSL-tolerant fetching with certificate hostname mismatch handling
- **Lines 911-1162:** Specialized fetch implementation with DNS pre-resolution
- **Lines 8840-9029:** Complete `loadVeronaManifest()` implementation

**Extended Manifest Mappings (Lines 8870-8877):**
```typescript
const manifestMappings: { [key: string]: string } = {
    '12': 'CXLV1331',
    '14': 'CVII1001',
    '15': 'LXXXIX841',
    '17': 'msClasseIII81',
    // Note: codice 16 mapping not found yet
};
```

## Service Integration

### 3. LibraryOptimizationService.ts
**File:** `/Users/evb/WebstormProjects/mss-downloader/src/main/services/LibraryOptimizationService.ts`

**Optimization Settings (Lines 165-169):**
```typescript
'verona': {
    maxConcurrentDownloads: 3, // Verona IIIF service via NBM
    delayBetweenRequests: 750,
    timeout: 180000,
    optimizationDescription: 'Verona NBM optimizations: 3 concurrent downloads, extended timeouts for large manuscripts (200+ pages), dynamic IIIF manifest discovery'
}
```

### 4. IntelligentProgressMonitor.ts
**File:** `/Users/evb/WebstormProjects/mss-downloader/src/main/services/IntelligentProgressMonitor.ts`

**Progress Monitoring (Lines 103-105):**
```typescript
case 'verona':
case 'nbm':
    // NBM Italy / Verona can have large manifests and slow downloads
```

### 5. SharedManifestAdapter.ts
**File:** `/Users/evb/WebstormProjects/mss-downloader/src/main/services/SharedManifestAdapter.ts`

**Library Support (Line 85):**
```typescript
const supportedLibraries = ['bdl', 'verona', 'vienna_manuscripta', 'bne', 'mdc_catalonia', 'florence', 'grenoble', 'manchester', 'toronto', 'vatican', 'karlsruhe', 'loc', 'graz', 'bvpb', 'morgan', 'hhu', 'duesseldorf', 'bordeaux'];
```

## Type Definitions

### 6. types.ts & queueTypes.ts
**Files:** 
- `/Users/evb/WebstormProjects/mss-downloader/src/shared/types.ts` (Line 31)
- `/Users/evb/WebstormProjects/mss-downloader/src/shared/queueTypes.ts` (Line 3)

**Library Type Inclusion:**
```typescript
library: '...' | 'verona' | '...'
```

## Test Coverage

### 7. E2E Tests
**Files:**
- `/Users/evb/WebstormProjects/mss-downloader/tests/e2e/verona-biblioteca.spec.ts`
- `/Users/evb/WebstormProjects/mss-downloader/tests/e2e/verona-ssl-fix-validation.spec.ts`

**Test Coverage:**
- Library detection for complex interface URLs
- Direct IIIF manifest URL handling
- SSL certificate issue resolution
- Timeout recovery mechanisms
- Multiple URL format validation
- Error handling for invalid URLs
- Queue item creation
- Optimization settings application

### 8. Validation Scripts
**Files:**
- `/Users/evb/WebstormProjects/mss-downloader/test-verona-pdf-validation.js`
- `/Users/evb/WebstormProjects/mss-downloader/test-verona-timeout-fix.js`

## Authentication & Special Processing

### URL Processing Logic
1. **Domain Detection:** Both `nuovabibliotecamanoscritta.it` and `nbm.regione.veneto.it`
2. **URL Types:**
   - Direct IIIF manifests: `nbm.regione.veneto.it/documenti/mirador_json/manifest/{ID}.json`
   - Viewer interface: `nuovabibliotecamanoscritta.it` with codice parameters
3. **Codice Extraction:** From `?codice=` or `?codiceDigital=` parameters
4. **Manifest Discovery:** HTML parsing or known mappings

### SSL & Network Handling
- **SSL Certificate Issues:** Resolved by avoiding `nuovabibliotecamanoscritta.it` direct connections
- **DNS Pre-resolution:** For ETIMEDOUT issues
- **Connection Pooling:** Enhanced agent configuration
- **Extended Timeouts:** 60-second socket timeout, 180-second total timeout
- **Retry Logic:** 15 attempts with exponential backoff

### Health Monitoring
- Server health checks before operations
- Fallback URL strategies (primary → IIIF server)
- Non-blocking health checks for maximum reliability

## Configuration Summary

**Supported Manuscript Codes:**
- 12 → CXLV1331
- 14 → CVII1001  
- 15 → LXXXIX841
- 17 → msClasseIII81

**Domains:**
- Primary: `www.nuovabibliotecamanoscritta.it` (viewer interface)
- IIIF Server: `nbm.regione.veneto.it` (direct manifests)

**Performance Settings:**
- Max Concurrent Downloads: 3
- Request Delay: 750ms
- Timeout: 180 seconds
- Retry Attempts: 15 with exponential backoff

## Notable Features

1. **Dynamic Manifest Discovery:** HTML parsing to find manifest URLs
2. **Intelligent Fallback:** Multiple URL resolution strategies
3. **Comprehensive Error Handling:** Specific messages for different failure modes
4. **IIIF 2.x Compatibility:** Full support with high-resolution image access
5. **SSL Resilience:** Certificate hostname mismatch handling
6. **Network Optimization:** Connection pooling and DNS pre-resolution

## Recent Updates

Based on package.json changelog:
"TIMEOUT FIX: Verona NBM retries increased to 15 attempts with non-blocking health checks for maximum reliability"

The implementation demonstrates sophisticated handling of the Verona/NBM library's complex infrastructure and reliability challenges.