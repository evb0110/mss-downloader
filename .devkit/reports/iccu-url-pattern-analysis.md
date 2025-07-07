# Internet Culturale (ICCU) URL Pattern Analysis

## Executive Summary

The Internet Culturale manuscript download issue stems from URL pattern differences between the working JMMS system and the failing DAM system. Both systems are valid IIIF sources but use different platforms and authentication mechanisms.

## URL Pattern Analysis

### FAILING URLs (DAM System)
- **Manifest URL**: `https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest`
- **Thumbnail URL**: `https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/thumbnail`
- **Status**: Both URLs return HTTP 200 with valid content
- **System**: DAM (Digital Asset Management) - IIIF 3.0 compliant
- **Content**: Single-page manuscript (likely folio-level IIIF manifest)

### WORKING URLs (JMMS System)  
- **Manifest URL**: `https://jmms.iccu.sbn.it/jmms/metadata/VFdGblZHVmpZU0F0SUVsRFExVV8_/b2FpOnd3dy5pbnRlcm5ldGN1bHR1cmFsZS5zYm4uaXQvVGVjYToyMDpOVDAwMDA6Q05NRFxcMDAwMDAxNjQxOQ__/manifest.json`
- **Status**: HTTP 200 with valid IIIF content (908KB response)
- **System**: JMMS (JSON Metadata Management System) - IIIF 3.0 compliant
- **Content**: Multi-page manuscript manifest

## Source Page Analysis

### Original Manuscript Page
**URL**: `https://manus.iccu.sbn.it/risultati-ricerca-manoscritti/-/manus-search/detail/646207`

**Key Finding**: The page uses a dynamic API system to load manifest URLs:

1. **API Endpoint**: `/o/manus-api/title?...&id=646207`
2. **Mirador Integration**: Uses handlebars template with `{{#each manifests}}manifest={{this}}&{{/each}}`
3. **Dynamic Loading**: Manifests are provided via JSON API response

### API Response Structure
The API returns a JSON structure with manifest URLs in the `manifests` field:
```json
{
  "manifests": ["https://dam.iccu.sbn.it/mol_46/containers/avQYjLe/manifest"]
}
```

## Technical Analysis

### Why DAM URLs "Fail" in Current Implementation

1. **Single-Page Manifests**: DAM system provides folio-level manifests (single pages) rather than complete manuscript manifests
2. **IIIF 3.0 Format**: Uses newer IIIF 3.0 structure which may not be fully compatible with current parsing logic
3. **Authentication Context**: DAM system may require session context from manus.iccu.sbn.it domain

### Why JMMS URLs Work

1. **Complete Manifests**: JMMS provides full manuscript manifests with multiple pages
2. **Established Authentication**: JMMS system handles authentication transparently
3. **Legacy Compatibility**: Uses structure compatible with existing parsing logic

## Implementation Recommendations

### 1. Dual System Support
Implement detection and handling for both DAM and JMMS systems:

```typescript
async function loadInternetCultureManifest(url: string): Promise<ManuscriptManifest> {
    if (url.includes('manus.iccu.sbn.it')) {
        // Extract manuscript ID from detail page URL
        const manuscriptId = extractManuscriptId(url);
        
        // Call API to get manifest URLs
        const apiUrl = `https://manus.iccu.sbn.it/o/manus-api/title?id=${manuscriptId}`;
        const response = await fetch(apiUrl, { /* session headers */ });
        const data = await response.json();
        
        if (data.manifests && data.manifests.length > 0) {
            const manifestUrl = data.manifests[0];
            
            if (manifestUrl.includes('dam.iccu.sbn.it')) {
                return this.loadDAMManifest(manifestUrl);
            } else if (manifestUrl.includes('jmms.iccu.sbn.it')) {
                return this.loadJMMSManifest(manifestUrl);
            }
        }
    }
    
    // Fallback to existing Internet Culturale logic
    return this.loadInternetCulturaleManifest(url);
}
```

### 2. DAM System Handler
Create specialized handler for DAM folio-level manifests:

```typescript
async function loadDAMManifest(manifestUrl: string): Promise<ManuscriptManifest> {
    const response = await fetch(manifestUrl);
    const manifest = await response.json();
    
    // DAM manifests are typically single-page (folio-level)
    // Extract container ID to potentially find related folios
    const containerId = extractContainerIdFromDAM(manifestUrl);
    
    // For single-page manifests, warn user about limitation
    if (manifest.items?.length === 1) {
        console.warn(`DAM manifest contains single folio. Container: ${containerId}`);
    }
    
    return parseIIIFManifest(manifest);
}
```

### 3. URL Pattern Detection
Update library detection to handle manus.iccu.sbn.it URLs:

```typescript
detectLibrary(url: string): string | null {
    // ... existing code ...
    
    if (url.includes('manus.iccu.sbn.it/risultati-ricerca-manoscritti')) return 'iccu_manus';
    if (url.includes('dam.iccu.sbn.it')) return 'vallicelliana'; // Keep existing DAM support
    if (url.includes('jmms.iccu.sbn.it')) return 'vallicelliana'; // Keep existing JMMS support
    
    // ... rest of existing code ...
}
```

### 4. Session Management
Implement proper session handling for ICCU systems:

```typescript
async function establishICCUSession(baseUrl: string): Promise<Headers> {
    // Visit base page to establish session
    await fetch(baseUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0...',
            'Accept': 'text/html,application/xhtml+xml...',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8'
        }
    });
    
    // Return headers for subsequent requests
    return {
        'Referer': baseUrl,
        'X-Requested-With': 'XMLHttpRequest'
    };
}
```

## Conclusion

The Internet Culturale issue is not a failure but a difference in manuscript granularity. DAM provides folio-level access while JMMS provides manuscript-level access. Both are valid IIIF sources that should be supported with appropriate user warnings about content scope.

**Recommended Action**: Implement dual system support with clear user feedback about manuscript vs. folio-level content, allowing users to download whatever content is available while understanding the scope limitations.