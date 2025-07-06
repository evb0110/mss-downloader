# E-Manuscripta IIIF Implementation Strategy

## Current State Analysis

The current E-Manuscripta implementation (lines 5819-6358 in `EnhancedManuscriptDownloaderService.ts`) uses complex multi-block logic that:

1. **Works but is overly complex**: Processes different URL types (titleinfo, thumbview, zoom) with multiple parsing methods
2. **Has proven validation success**: The IIIF validation shows 404 canvases successfully extracted from manifest ID 5157222
3. **Needs simplification**: The multi-method approach (dropdown parsing, JS config, deep HTML, URL pattern discovery) can be replaced with simple IIIF manifest processing

## Implementation Strategy

### **Phase 1: Add IIIF Manifest Support (Primary Method)**

Replace the complex multi-block logic with a simple IIIF-first approach while maintaining backward compatibility.

#### **1.1 Modify `loadEManuscriptaManifest()` Function**

**Location**: Lines 5819-5925  
**Strategy**: Replace entire function implementation while maintaining same signature

**Current signature**:
```typescript
async loadEManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest>
```

**New implementation approach**:

```typescript
async loadEManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
    try {
        console.log(`Loading e-manuscripta.ch manifest from: ${manuscriptaUrl}`);
        
        // STEP 1: Extract manuscript ID from URL (any format)
        const manuscriptId = this.extractEManuscriptaId(manuscriptaUrl);
        
        // STEP 2: Try IIIF manifest first (new primary method)
        try {
            const iiifManifest = await this.loadEManuscriptaIIIFManifest(manuscriptId);
            console.log(`e-manuscripta: IIIF manifest loaded successfully with ${iiifManifest.totalPages} pages`);
            return iiifManifest;
        } catch (iiifError) {
            console.warn(`e-manuscripta: IIIF manifest failed: ${iiifError.message}`);
            console.log('e-manuscripta: Falling back to legacy multi-block parsing...');
        }
        
        // STEP 3: Fallback to existing complex logic (backward compatibility)
        return await this.loadEManuscriptaLegacy(manuscriptaUrl);
        
    } catch (error: any) {
        console.error(`Failed to load e-manuscripta.ch manifest: ${error.message}`);
        throw error;
    }
}
```

#### **1.2 Add New IIIF Manifest Processing Function**

**New function** (add after line 5925):

```typescript
/**
 * Load E-Manuscripta manifest using IIIF v2 API (new primary method)
 */
private async loadEManuscriptaIIIFManifest(manuscriptId: string): Promise<ManuscriptManifest> {
    const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;
    
    console.log(`e-manuscripta: Fetching IIIF manifest from: ${manifestUrl}`);
    
    // Fetch IIIF manifest
    const response = await this.fetchDirect(manifestUrl);
    if (!response.ok) {
        throw new Error(`IIIF manifest not available: HTTP ${response.status}`);
    }
    
    const manifestData = await response.json();
    
    // Validate IIIF v2 structure
    if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
        throw new Error('Invalid IIIF v2 manifest structure');
    }
    
    const canvases = manifestData.sequences[0].canvases;
    console.log(`e-manuscripta: Found ${canvases.length} canvases in IIIF manifest`);
    
    // Extract maximum resolution image URLs
    const pageLinks: string[] = [];
    for (const canvas of canvases) {
        if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
            const resource = canvas.images[0].resource;
            
            if (resource.service && resource.service['@id']) {
                // Use IIIF Image API for maximum resolution
                const imageServiceUrl = resource.service['@id'];
                pageLinks.push(`${imageServiceUrl}/full/full/0/default.jpg`);
            } else if (resource['@id']) {
                // Direct image URL fallback
                pageLinks.push(resource['@id']);
            }
        }
    }
    
    if (pageLinks.length === 0) {
        throw new Error('No image URLs found in IIIF manifest');
    }
    
    // Validate first few images to ensure they work
    await this.validateEManuscriptaURLs(pageLinks.slice(0, 3));
    
    // Extract display name from manifest
    const displayName = manifestData.label || `e-manuscripta ${manuscriptId}`;
    
    console.log(`e-manuscripta: IIIF manifest processed - ${pageLinks.length} pages for "${displayName}"`);
    
    return {
        pageLinks,
        totalPages: pageLinks.length,
        library: 'e_manuscripta',
        displayName,
        originalUrl: `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`,
    };
}
```

#### **1.3 Add ID Extraction Helper**

**New function** (add after IIIF function):

```typescript
/**
 * Extract manuscript ID from any E-Manuscripta URL format
 */
private extractEManuscriptaId(url: string): string {
    // Support all known URL patterns:
    // - https://www.e-manuscripta.ch/{library}/content/zoom/{id}
    // - https://www.e-manuscripta.ch/{library}/content/titleinfo/{id}
    // - https://www.e-manuscripta.ch/{library}/content/thumbview/{id}
    // - https://www.e-manuscripta.ch/i3f/v20/{id}/manifest (direct IIIF)
    
    const patterns = [
        /e-manuscripta\.ch\/[^/]+\/content\/(?:zoom|titleinfo|thumbview)\/(\d+)/,
        /e-manuscripta\.ch\/i3f\/v20\/(\d+)\/manifest/,
        /e-manuscripta\.ch\/.*\/(\d+)/, // General fallback
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    throw new Error(`Cannot extract manuscript ID from URL: ${url}`);
}
```

#### **1.4 Rename Existing Complex Logic to Legacy**

**Refactor existing functions** (lines 5927-6358):

1. Rename all existing helper functions with `Legacy` suffix:
   - `parseEManuscriptaDropdown` → `parseEManuscriptaDropdownLegacy`
   - `parseEManuscriptaJSConfig` → `parseEManuscriptaJSConfigLegacy`
   - `parseEManuscriptaDeepHTML` → `parseEManuscriptaDeepHTMLLegacy`
   - `discoverEManuscriptaURLPattern` → `discoverEManuscriptaURLPatternLegacy`
   - `handleEManuscriptaTitleInfo` → `handleEManuscriptaTitleInfoLegacy`
   - `handleEManuscriptaThumbView` → `handleEManuscriptaThumbViewLegacy`
   - `extractAllThumbviewBlocksFromStructure` → `extractAllThumbviewBlocksFromStructureLegacy`

2. Create new legacy wrapper function:

```typescript
/**
 * Legacy E-Manuscripta processing (fallback for when IIIF fails)
 */
private async loadEManuscriptaLegacy(manuscriptaUrl: string): Promise<ManuscriptManifest> {
    // Move all existing complex logic here (lines 5823-5924)
    // This maintains 100% backward compatibility
    
    // Extract manuscript ID and library from URL
    const urlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/;
    const urlMatch = manuscriptaUrl.match(urlPattern);
    
    if (!urlMatch) {
        throw new Error('Invalid e-manuscripta.ch URL format for legacy processing');
    }
    
    const [, library, urlType, manuscriptId] = urlMatch;
    
    // Handle different URL types (existing logic)
    if (urlType === 'titleinfo') {
        return await this.handleEManuscriptaTitleInfoLegacy(manuscriptaUrl, library, manuscriptId);
    } else if (urlType === 'thumbview') {
        return await this.handleEManuscriptaThumbViewLegacy(manuscriptaUrl, library, manuscriptId);
    }
    
    // Continue with existing zoom URL handling...
    // [Rest of existing implementation]
}
```

### **Phase 2: Testing Strategy**

#### **2.1 Validation Protocol**

1. **Test IIIF manifest URLs directly**:
   - `https://www.e-manuscripta.ch/i3f/v20/5157222/manifest`
   - `https://www.e-manuscripta.ch/i3f/v20/123456/manifest` (test error handling)

2. **Test backward compatibility with existing URLs**:
   - Titleinfo URLs that should fall back to legacy
   - Thumbview URLs for multi-block manuscripts
   - Single zoom URLs

3. **Test maximum resolution**:
   - Compare IIIF image sizes vs legacy webcache URLs
   - Verify `/full/full/0/default.jpg` provides highest quality

#### **2.2 Comprehensive Test Suite**

Create test file: `.devkit/temp/test-e-manuscripta-iiif-implementation.cjs`

```javascript
const https = require('https');

// Test IIIF manifest availability
async function testIIIFManifest(manuscriptId) {
    const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;
    // Test logic here
}

// Test image resolution comparison
async function compareResolutions(manuscriptId) {
    // Compare IIIF vs legacy webcache URLs
    // Measure file sizes and image dimensions
}

// Test multiple manuscripts
const testManuscripts = ['5157222', '1234567', '9999999']; // Valid, invalid, edge case
```

### **Phase 3: Backward Compatibility Considerations**

#### **3.1 Graceful Degradation**

1. **IIIF First**: Always try IIIF manifest first
2. **Fallback Chain**: If IIIF fails, use existing complex multi-block logic
3. **Error Context**: Provide clear error messages indicating which method failed
4. **URL Support**: Maintain support for all existing URL patterns

#### **3.2 Library Field Consistency**

- Keep `library: 'e_manuscripta'` in all manifests
- Ensure UI and queue processing remain unchanged
- Maintain same `displayName` format patterns

### **Phase 4: Error Handling Strategy**

#### **4.1 IIIF Specific Errors**

```typescript
// In loadEManuscriptaIIIFManifest()
try {
    const response = await this.fetchDirect(manifestUrl);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Manuscript ${manuscriptId} not available via IIIF`);
        } else {
            throw new Error(`IIIF manifest server error: HTTP ${response.status}`);
        }
    }
    // ... rest of processing
} catch (error) {
    if (error.message.includes('IIIF')) {
        // IIIF-specific error, suitable for fallback
        throw error;
    } else {
        // Network or parsing error, may need different handling
        throw new Error(`IIIF processing failed: ${error.message}`);
    }
}
```

#### **4.2 Fallback Error Context**

```typescript
// In main loadEManuscriptaManifest()
catch (iiifError) {
    console.warn(`e-manuscripta: IIIF manifest failed: ${iiifError.message}`);
    
    if (iiifError.message.includes('not available via IIIF')) {
        console.log('e-manuscripta: Manuscript not in IIIF collection, using legacy parsing');
    } else {
        console.log('e-manuscripta: IIIF technical error, falling back to legacy parsing');
    }
    
    // Try legacy method
}
```

### **Phase 5: Maximum Resolution Optimization**

#### **5.1 IIIF Image API Usage**

Use IIIF Image API pattern for maximum resolution:
- `{service_id}/full/full/0/default.jpg` - Full resolution, no rotation, default quality
- This should provide higher resolution than current `/webcache/0/` URLs

#### **5.2 Resolution Comparison**

Add logging to compare file sizes:

```typescript
// In validation function
const iiifImageSize = await this.getImageSize(iiifUrl);
const legacyImageSize = await this.getImageSize(legacyUrl);

console.log(`e-manuscripta: Resolution comparison - IIIF: ${iiifImageSize}KB vs Legacy: ${legacyImageSize}KB`);
```

## Implementation Priority

### **Phase 1 (High Priority)**
1. ✅ **Validated**: IIIF manifests work (404 canvases confirmed)
2. 🎯 **Next**: Implement `loadEManuscriptaIIIFManifest()` function
3. 🎯 **Next**: Add fallback wrapper for existing logic

### **Phase 2 (Medium Priority)**
1. Test multiple manuscript IDs for IIIF availability
2. Compare image resolutions between IIIF and legacy methods
3. Validate backward compatibility with existing URLs

### **Phase 3 (Low Priority)**
1. Optimize error messaging for user experience
2. Add progress logging for complex multi-block manuscripts
3. Consider caching IIIF manifests for performance

## Key Benefits

1. **Simplicity**: Single IIIF API call replaces complex multi-block parsing
2. **Maximum Resolution**: IIIF Image API provides highest available quality
3. **Reliability**: Standard IIIF protocol is more stable than scraping
4. **Performance**: Faster manifest loading, fewer HTTP requests
5. **Backward Compatibility**: Existing URLs continue to work via fallback
6. **Future-Proof**: IIIF is the standard for digital manuscript collections

## Minimal Code Changes

**Total lines to modify**: ~150 lines (add new functions, modify main function)
**Lines to remove**: 0 (maintain all existing functions as legacy)
**Risk level**: **LOW** (purely additive with fallback)

The strategy provides a **surgical fix** that replaces complex logic with simple IIIF processing while maintaining 100% backward compatibility.