# E-Manuscripta IIIF Implementation - Exact Code Changes

## 1. Replace `loadEManuscriptaManifest()` Function

**Location**: Lines 5819-5925 in `EnhancedManuscriptDownloaderService.ts`

**Replace entire function with**:

```typescript
async loadEManuscriptaManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
    try {
        console.log(`Loading e-manuscripta.ch manifest from: ${manuscriptaUrl}`);
        
        // Extract manuscript ID from URL (any format)
        const manuscriptId = this.extractEManuscriptaId(manuscriptaUrl);
        
        // Try IIIF manifest first (new primary method)
        try {
            const iiifManifest = await this.loadEManuscriptaIIIFManifest(manuscriptId);
            console.log(`e-manuscripta: IIIF manifest loaded successfully with ${iiifManifest.totalPages} pages`);
            return iiifManifest;
        } catch (iiifError: any) {
            console.warn(`e-manuscripta: IIIF manifest failed: ${iiifError.message}`);
            console.log('e-manuscripta: Falling back to legacy multi-block parsing...');
        }
        
        // Fallback to existing complex logic (backward compatibility)
        return await this.loadEManuscriptaLegacy(manuscriptaUrl);
        
    } catch (error: any) {
        console.error(`Failed to load e-manuscripta.ch manifest: ${(error as Error).message}`);
        throw error;
    }
}
```

## 2. Add New IIIF Processing Function

**Location**: Insert after line 5925 (after the old `loadEManuscriptaManifest()` function)

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
        if (response.status === 404) {
            throw new Error(`Manuscript ${manuscriptId} not available via IIIF (HTTP 404)`);
        } else {
            throw new Error(`IIIF manifest server error: HTTP ${response.status}`);
        }
    }
    
    const manifestData = await response.json();
    
    // Validate IIIF v2 structure
    if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
        throw new Error('Invalid IIIF v2 manifest structure - missing sequences or canvases');
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
        throw new Error('No image URLs found in IIIF manifest canvases');
    }
    
    // Validate first few images to ensure they work
    await this.validateEManuscriptaURLs(pageLinks.slice(0, Math.min(3, pageLinks.length)));
    
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
        if (match && match[1]) {
            console.log(`e-manuscripta: Extracted ID ${match[1]} from URL using pattern: ${pattern.toString()}`);
            return match[1];
        }
    }
    
    throw new Error(`Cannot extract manuscript ID from URL: ${url}`);
}

/**
 * Legacy E-Manuscripta processing (fallback for when IIIF fails)
 */
private async loadEManuscriptaLegacy(manuscriptaUrl: string): Promise<ManuscriptManifest> {
    console.log('e-manuscripta: Using legacy multi-block parsing method');
    
    // Extract manuscript ID and library from URL
    const urlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/;
    const urlMatch = manuscriptaUrl.match(urlPattern);
    
    if (!urlMatch) {
        throw new Error('Invalid e-manuscripta.ch URL format. Expected: https://www.e-manuscripta.ch/{library}/content/{zoom|titleinfo|thumbview}/{id}');
    }
    
    const [, library, urlType, manuscriptId] = urlMatch;
    
    console.log(`e-manuscripta: Legacy processing - URL type: ${urlType}, library: ${library}, ID: ${manuscriptId}`);
    
    // Handle different URL types
    if (urlType === 'titleinfo') {
        // For titleinfo URLs, extract all related thumbview blocks and aggregate them
        return await this.handleEManuscriptaTitleInfoLegacy(manuscriptaUrl, library, manuscriptId);
    } else if (urlType === 'thumbview') {
        // For thumbview URLs, process as individual blocks
        return await this.handleEManuscriptaThumbViewLegacy(manuscriptaUrl, library, manuscriptId);
    }
    
    // Continue with existing zoom URL handling
    // Fetch the viewer page to extract metadata and determine page count
    const viewerResponse = await this.fetchDirect(manuscriptaUrl);
    if (!viewerResponse.ok) {
        throw new Error(`Failed to load viewer page: HTTP ${viewerResponse.status}`);
    }
    
    const viewerHtml = await viewerResponse.text();
    
    // Extract title/manuscript name from the page
    let displayName = `e-manuscripta ${manuscriptId}`;
    const titleMatch = viewerHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1] && !titleMatch[1].includes('e-manuscripta.ch')) {
        displayName = titleMatch[1].trim();
    }
    
    // Multi-method approach for robust page detection following Agent 5 recommendations
    let pageData: Array<{pageId: string, pageNumber: number}> = [];
    
    // METHOD 1: Parse goToPage dropdown (most reliable)
    pageData = await this.parseEManuscriptaDropdownLegacy(viewerHtml);
    
    if (pageData.length === 0) {
        // METHOD 2: Parse JavaScript configuration data
        console.log('e-manuscripta: Trying JavaScript config extraction');
        pageData = await this.parseEManuscriptaJSConfigLegacy(viewerHtml);
    }
    
    if (pageData.length === 0) {
        // METHOD 3: Deep HTML analysis with multiple patterns
        console.log('e-manuscripta: Trying deep HTML pattern analysis');
        pageData = await this.parseEManuscriptaDeepHTMLLegacy(viewerHtml);
    }
    
    if (pageData.length === 0) {
        // METHOD 4: URL pattern discovery using current page as base
        console.log('e-manuscripta: Trying URL pattern discovery');
        pageData = await this.discoverEManuscriptaURLPatternLegacy(manuscriptId, library);
    }
    
    if (pageData.length === 0) {
        console.error('e-manuscripta: All legacy parsing methods failed, cannot determine page structure');
        throw new Error('Unable to determine manuscript page structure - all parsing methods failed');
    }
    
    // Sort by page number to ensure correct order
    pageData.sort((a, b) => a.pageNumber - b.pageNumber);
    
    console.log(`e-manuscripta: Legacy processing - Successfully found ${pageData.length} pages for ${displayName}`);
    console.log(`e-manuscripta: Page range [${pageData[0]?.pageNumber}] to [${pageData[pageData.length - 1]?.pageNumber}]`);
    console.log(`e-manuscripta: First page ID: ${pageData[0]?.pageId}, Last page ID: ${pageData[pageData.length - 1]?.pageId}`);
    
    // Generate page links using the actual page IDs (Agent 3 optimal URL pattern)
    const pageLinks: string[] = pageData.map(page => 
        `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.pageId}`
    );
    
    // Validate that URLs actually work by testing first few pages (Agent 4 recommendation)
    await this.validateEManuscriptaURLs(pageLinks.slice(0, 3));
    
    console.log(`e-manuscripta: Legacy processing - Generated and validated ${pageLinks.length} image URLs`);
    
    const eManuscriptaManifest: ManuscriptManifest = {
        pageLinks,
        totalPages: pageLinks.length,
        library: 'e_manuscripta',
        displayName,
        originalUrl: manuscriptaUrl,
    };
    
    console.log(`e-manuscripta: Legacy processing - Created manifest for "${displayName}" with ${pageLinks.length} pages`);
    return eManuscriptaManifest;
}
```

## 3. Rename Existing Helper Functions

**Rename all existing helper functions to add "Legacy" suffix**:

### Functions to rename (add "Legacy" suffix):

**Lines 5927-5974**: `parseEManuscriptaDropdown` → `parseEManuscriptaDropdownLegacy`
```typescript
private async parseEManuscriptaDropdownLegacy(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
    // Keep existing implementation unchanged
}
```

**Lines 5976-6000**: `parseEManuscriptaJSConfig` → `parseEManuscriptaJSConfigLegacy`
```typescript
private async parseEManuscriptaJSConfigLegacy(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
    // Keep existing implementation unchanged
}
```

**Lines 6002-6044**: `parseEManuscriptaDeepHTML` → `parseEManuscriptaDeepHTMLLegacy`
```typescript
private async parseEManuscriptaDeepHTMLLegacy(html: string): Promise<Array<{pageId: string, pageNumber: number}>> {
    // Keep existing implementation unchanged
}
```

**Lines 6046-6127**: `discoverEManuscriptaURLPattern` → `discoverEManuscriptaURLPatternLegacy`
```typescript
private async discoverEManuscriptaURLPatternLegacy(baseId: string, library: string): Promise<Array<{pageId: string, pageNumber: number}>> {
    // Keep existing implementation unchanged
}
```

**Lines 6157-6232**: `handleEManuscriptaTitleInfo` → `handleEManuscriptaTitleInfoLegacy`
```typescript
private async handleEManuscriptaTitleInfoLegacy(titleinfoUrl: string, library: string, manuscriptId: string): Promise<ManuscriptManifest> {
    // Keep existing implementation unchanged, but update internal calls to use Legacy suffix
    // Change: this.handleEManuscriptaThumbView → this.handleEManuscriptaThumbViewLegacy
    // Change: this.extractAllThumbviewBlocksFromStructure → this.extractAllThumbviewBlocksFromStructureLegacy
}
```

**Lines 6237-6318**: `handleEManuscriptaThumbView` → `handleEManuscriptaThumbViewLegacy`
```typescript
private async handleEManuscriptaThumbViewLegacy(thumbviewUrl: string, library: string, blockId: string): Promise<ManuscriptManifest> {
    // Keep existing implementation unchanged, but update internal calls to use Legacy suffix
    // Change: this.parseEManuscriptaDropdown → this.parseEManuscriptaDropdownLegacy
    // Change: this.parseEManuscriptaJSConfig → this.parseEManuscriptaJSConfigLegacy
    // Change: this.parseEManuscriptaDeepHTML → this.parseEManuscriptaDeepHTMLLegacy
    // Change: this.discoverEManuscriptaURLPattern → this.discoverEManuscriptaURLPatternLegacy
}
```

**Lines 6323-6358**: `extractAllThumbviewBlocksFromStructure` → `extractAllThumbviewBlocksFromStructureLegacy`
```typescript
private async extractAllThumbviewBlocksFromStructureLegacy(structureHtml: string, library: string): Promise<string[]> {
    // Keep existing implementation unchanged
}
```

## 4. Update Internal Function Calls

**In `handleEManuscriptaTitleInfoLegacy()` around line 6204**:
```typescript
// OLD:
const blockManifest = await this.handleEManuscriptaThumbView(thumbviewUrl, library, thumbviewUrl.split('/').pop()!);

// NEW:
const blockManifest = await this.handleEManuscriptaThumbViewLegacy(thumbviewUrl, library, thumbviewUrl.split('/').pop()!);
```

**In `handleEManuscriptaTitleInfoLegacy()` around line 6187**:
```typescript
// OLD:
const thumbviewUrls = await this.extractAllThumbviewBlocksFromStructure(structureHtml, library);

// NEW:
const thumbviewUrls = await this.extractAllThumbviewBlocksFromStructureLegacy(structureHtml, library);
```

**In `handleEManuscriptaThumbViewLegacy()` around lines 6260-6277**:
```typescript
// OLD:
pageData = await this.parseEManuscriptaDropdown(html);
pageData = await this.parseEManuscriptaJSConfig(html);
pageData = await this.parseEManuscriptaDeepHTML(html);
pageData = await this.discoverEManuscriptaURLPattern(blockId, library);

// NEW:
pageData = await this.parseEManuscriptaDropdownLegacy(html);
pageData = await this.parseEManuscriptaJSConfigLegacy(html);
pageData = await this.parseEManuscriptaDeepHTMLLegacy(html);
pageData = await this.discoverEManuscriptaURLPatternLegacy(blockId, library);
```

## 5. Testing and Validation

### Create Test Script: `.devkit/temp/test-e-manuscripta-iiif-fix.cjs`

```javascript
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.js');

async function testEManuscriptaIIIF() {
    const service = new EnhancedManuscriptDownloaderService();
    
    // Test 1: Direct IIIF URL (should use new method)
    console.log('Testing direct IIIF URL...');
    try {
        const manifest1 = await service.loadEManuscriptaManifest('https://www.e-manuscripta.ch/i3f/v20/5157222/manifest');
        console.log(`✅ IIIF Direct: ${manifest1.totalPages} pages - ${manifest1.displayName}`);
    } catch (error) {
        console.log(`❌ IIIF Direct failed: ${error.message}`);
    }
    
    // Test 2: Legacy titleinfo URL (should fallback)
    console.log('Testing legacy titleinfo URL...');
    try {
        const manifest2 = await service.loadEManuscriptaManifest('https://www.e-manuscripta.ch/zuz/content/titleinfo/5157222');
        console.log(`✅ Legacy titleinfo: ${manifest2.totalPages} pages - ${manifest2.displayName}`);
    } catch (error) {
        console.log(`❌ Legacy titleinfo failed: ${error.message}`);
    }
    
    // Test 3: Legacy zoom URL (should try IIIF first, then fallback)
    console.log('Testing legacy zoom URL...');
    try {
        const manifest3 = await service.loadEManuscriptaManifest('https://www.e-manuscripta.ch/zuz/content/zoom/5157222');
        console.log(`✅ Legacy zoom: ${manifest3.totalPages} pages - ${manifest3.displayName}`);
    } catch (error) {
        console.log(`❌ Legacy zoom failed: ${error.message}`);
    }
}

testEManuscriptaIIIF().catch(console.error);
```

## Summary

**Changes Required**:
1. **Replace 1 function**: `loadEManuscriptaManifest()` (lines 5819-5925)
2. **Add 3 new functions**: IIIF processing, ID extraction, legacy wrapper
3. **Rename 6 existing functions**: Add "Legacy" suffix for backward compatibility
4. **Update internal calls**: Change function names to use Legacy versions

**Total Lines Changed**: ~150 lines  
**Lines Removed**: 0 (everything preserved as legacy)  
**Risk Level**: **MINIMAL** (purely additive with fallback)  

**Benefits**:
- ✅ **Simple IIIF processing** replaces complex multi-block parsing
- ✅ **Maximum resolution** via IIIF Image API
- ✅ **100% backward compatibility** with existing URLs
- ✅ **Graceful fallback** to existing logic when IIIF unavailable
- ✅ **Future-proof** using standard IIIF protocol