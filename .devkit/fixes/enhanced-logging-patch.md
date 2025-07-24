# Enhanced Logging Patch for EnhancedManuscriptDownloaderService

This patch adds comprehensive logging to track LOC (Library of Congress) download issues, including timeouts, stalls, retries, and errors.

## 1. fetchDirect Method Enhancements

### Add logging at the beginning of the method:
```typescript
async fetchDirect(url: string, options: any = {}, attempt: number = 1): Promise<Response> {
    const startTime = Date.now();
    console.log(`[fetchDirect] Starting request for URL: ${url} (attempt ${attempt})`);
    
    // Always create our own controller for library-specific timeouts
    const controller = new AbortController();
```

### Add logging for library detection and timeout calculation:
```typescript
    // Detect library and apply optimized timeout
    const library = this.detectLibrary(url) as TLibrary;
    const baseTimeout = configService.get('requestTimeout');
    const timeout = library ? 
        LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library, attempt) :
        baseTimeout;
    
    console.log(`[fetchDirect] Library detected: ${library || 'unknown'}, timeout: ${timeout}ms (base: ${baseTimeout}ms)`);
```

### Enhance timeout logging with more details:
```typescript
    const timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`[fetchDirect] TIMEOUT: Request timed out after ${elapsed}ms (configured timeout: ${timeout}ms) for ${library || 'unknown'} library: ${url}`);
        console.error(`[fetchDirect] Timeout details - Attempt: ${attempt}, Library: ${library}, URL: ${url}`);
        controller.abort();
    }, timeout);
```

### Add logging before the actual fetch:
```typescript
    try {
        console.log(`[fetchDirect] Executing fetch with headers:`, JSON.stringify(headers, null, 2));
        
        // SSL-tolerant fetching for Verona domains with certificate hostname mismatch
        const fetchOptions: any = {
```

### Add response logging in the try block:
```typescript
        const response = await fetch(url, fetchOptions);
        if (timeoutId) clearTimeout(timeoutId);
        
        const elapsed = Date.now() - startTime;
        console.log(`[fetchDirect] Response received for ${url} - Status: ${response.status}, Time: ${elapsed}ms`);
        
        return response;
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        
        const elapsed = Date.now() - startTime;
        console.error(`[fetchDirect] ERROR after ${elapsed}ms for ${url}:`, error);
        console.error(`[fetchDirect] Error details - Name: ${error.name}, Message: ${error.message}`);
        if (error.stack) {
            console.error(`[fetchDirect] Stack trace:`, error.stack);
        }
        
        throw error;
    }
```

## 2. downloadImageWithRetries Method Enhancements

### Add logging at the beginning:
```typescript
async downloadImageWithRetries(url: string, attempt = 0): Promise<ArrayBuffer> {
    const startTime = Date.now();
    console.log(`[downloadImageWithRetries] Starting download for: ${url} (attempt ${attempt + 1})`);
    
    try {
```

### Add logging for proxy fallback decision:
```typescript
        const needsProxyFallback = url.includes('digitallibrary.unicatt.it') || 
                                 url.includes('mediatheques.orleans.fr') || 
                                 url.includes('aurelia.orleans.fr') || 
                                 url.includes('bdl.servizirl.it');
        
        console.log(`[downloadImageWithRetries] Proxy fallback needed: ${needsProxyFallback}`);
```

### Add logging before fetch attempts:
```typescript
        let response: Response;
        try {
            console.log(`[downloadImageWithRetries] Attempting fetch via ${needsProxyFallback ? 'proxy' : 'direct'} method`);
            
            response = needsProxyFallback
                ? await this.fetchWithProxyFallback(url)
                : await this.fetchDirect(url, {}, attempt + 1);
```

### Add logging for response validation:
```typescript
        if (!response.ok) {
            console.error(`[downloadImageWithRetries] HTTP error for ${url}: ${response.status} ${response.statusText}`);
            
            // Enhanced error messages for BNC Roma HTTP errors
```

### Add logging for successful buffer download:
```typescript
        const buffer = await response.arrayBuffer();
        const elapsed = Date.now() - startTime;
        
        console.log(`[downloadImageWithRetries] Buffer downloaded - Size: ${buffer.byteLength} bytes, Time: ${elapsed}ms`);
        
        if (buffer.byteLength < MIN_VALID_IMAGE_SIZE_BYTES) {
            console.error(`[downloadImageWithRetries] Image too small: ${buffer.byteLength} bytes (min: ${MIN_VALID_IMAGE_SIZE_BYTES})`);
            throw new Error(`Image too small: ${buffer.byteLength} bytes`);
        }
```

### Enhance retry logging:
```typescript
    } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.error(`[downloadImageWithRetries] Error after ${elapsed}ms:`, error.message);
        
        const maxRetries = configService.get('maxRetries');
        if (attempt < maxRetries) {
            // Log retry decision
            const library = this.detectLibrary(url) as TLibrary;
            const useProgressiveBackoff = library && 
                LibraryOptimizationService.getOptimizationsForLibrary(library).enableProgressiveBackoff;
                
            const delay = useProgressiveBackoff 
                ? LibraryOptimizationService.calculateProgressiveBackoff(attempt + 1)
                : this.calculateRetryDelay(attempt);
            
            console.log(`[downloadImageWithRetries] Will retry - Library: ${library}, Progressive backoff: ${useProgressiveBackoff}, Delay: ${delay}ms`);
            console.log(`[downloadImageWithRetries] Retrying ${url} (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms delay`);
```

### Add final failure logging:
```typescript
        console.error(`[downloadImageWithRetries] FINAL FAILURE after ${maxRetries + 1} attempts for ${url}`);
        console.error(`[downloadImageWithRetries] Total time spent: ${Date.now() - startTime}ms`);
        
        throw new Error(`Failed after ${maxRetries} attempts: ${(error as Error).message}`);
```

## 3. loadLocManifest Method Enhancements

### Enhance initial logging:
```typescript
async loadLocManifest(locUrl: string): Promise<ManuscriptManifest> {
    const startTime = Date.now();
    console.log(`[loadLocManifest] Starting LOC manifest load for: ${locUrl}`);
    
    this.logger.log({
        level: 'info',
        library: 'loc',
        url: locUrl,
        message: 'Starting LOC manifest load',
        timestamp: new Date().toISOString()
    });
```

### Add URL transformation logging:
```typescript
    try {
        let manifestUrl = locUrl;
        
        console.log(`[loadLocManifest] Processing URL pattern...`);
        
        // Handle different LOC URL patterns
        if (locUrl.includes('/item/')) {
            // Extract item ID: https://www.loc.gov/item/2010414164/
            const itemMatch = locUrl.match(/\/item\/([^/?]+)/);
            if (itemMatch) {
                manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
                console.log(`[loadLocManifest] Transformed item URL to manifest: ${manifestUrl}`);
            }
        } else if (locUrl.includes('/resource/')) {
            // Extract resource ID: https://www.loc.gov/resource/rbc0001.2022vollb14164/?st=gallery
            const resourceMatch = locUrl.match(/\/resource\/([^/?]+)/);
            if (resourceMatch) {
                // Try to construct manifest URL from resource pattern
                manifestUrl = `https://www.loc.gov/resource/${resourceMatch[1]}/manifest.json`;
                console.log(`[loadLocManifest] Transformed resource URL to manifest: ${manifestUrl}`);
            }
        }
```

### Add manifest fetch logging:
```typescript
        progressMonitor.updateProgress(1, 10, 'Fetching manifest...');
        
        console.log(`[loadLocManifest] Fetching manifest from: ${manifestUrl}`);
        const fetchStartTime = Date.now();
        
        // Load IIIF manifest
        const response = await this.fetchDirect(manifestUrl, {}, 0, controller.signal);
        
        const fetchElapsed = Date.now() - fetchStartTime;
        console.log(`[loadLocManifest] Manifest fetch completed - Status: ${response.status}, Time: ${fetchElapsed}ms`);
        
        if (!response.ok) {
            console.error(`[loadLocManifest] Failed to load manifest - HTTP ${response.status}: ${response.statusText}`);
            throw new Error(`Failed to load LOC manifest: HTTP ${response.status}`);
        }
```

### Add manifest parsing logging:
```typescript
        const manifest = await response.json();
        console.log(`[loadLocManifest] Manifest parsed successfully - Type: ${manifest['@type'] || 'unknown'}`);
        
        progressMonitor.updateProgress(3, 10, 'Parsing manifest...');
```

### Add page extraction logging:
```typescript
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            totalPages = canvases.length;
            
            console.log(`[loadLocManifest] Found ${totalPages} canvases in manifest`);
            progressMonitor.updateProgress(5, 10, `Processing ${totalPages} pages...`);
            
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0]) {
                    const image = canvas.images[0];
                    if (image.resource && image.resource.service && image.resource.service['@id']) {
                        // Use IIIF service for maximum resolution
                        const serviceId = image.resource.service['@id'];
                        const maxResUrl = `${serviceId}/full/full/0/default.jpg`;
                        pageLinks.push(maxResUrl);
                        
                        if (i === 0 || i === canvases.length - 1 || i % 10 === 0) {
                            console.log(`[loadLocManifest] Page ${i + 1}/${totalPages}: ${maxResUrl}`);
                        }
                    } else if (image.resource && image.resource['@id']) {
                        // Fallback to direct resource URL
                        pageLinks.push(image.resource['@id']);
                        console.log(`[loadLocManifest] Page ${i + 1} using fallback URL`);
                    }
                }
            }
        }
```

### Add completion logging:
```typescript
        const totalElapsed = Date.now() - startTime;
        console.log(`[loadLocManifest] Successfully loaded manifest - Total pages: ${pageLinks.length}, Time: ${totalElapsed}ms`);
        console.log(`[loadLocManifest] Display name: ${displayName}`);
        
        const locManifest = {
```

### Enhance error logging:
```typescript
    } catch (error: any) {
        progressMonitor.abort();
        
        const elapsed = Date.now() - startTime;
        console.error(`[loadLocManifest] FAILED after ${elapsed}ms:`, error.message);
        console.error(`[loadLocManifest] Error details:`, {
            url: locUrl,
            manifestUrl: manifestUrl || 'not determined',
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack
        });
        
        throw new Error(`Failed to load Library of Congress manuscript: ${(error as Error).message}`);
    }
```

## 4. Additional LOC-specific Error Handling

Add a new method for LOC-specific stall detection:

```typescript
private detectLocStall(url: string, startTime: number, expectedSize?: number): boolean {
    const elapsed = Date.now() - startTime;
    const isLoc = url.includes('loc.gov') || url.includes('tile.loc.gov');
    
    if (!isLoc) return false;
    
    // LOC-specific stall detection thresholds
    const STALL_THRESHOLD = 30000; // 30 seconds
    const SLOW_THRESHOLD = 15000; // 15 seconds
    
    if (elapsed > STALL_THRESHOLD) {
        console.error(`[detectLocStall] STALL DETECTED: LOC download taking over ${STALL_THRESHOLD}ms for ${url}`);
        return true;
    }
    
    if (elapsed > SLOW_THRESHOLD) {
        console.warn(`[detectLocStall] SLOW DOWNLOAD: LOC download taking over ${SLOW_THRESHOLD}ms for ${url}`);
    }
    
    return false;
}
```

## Summary

This patch adds comprehensive logging throughout the download pipeline with focus on:

1. **Request timing** - Track how long each request takes
2. **Library detection** - Log which library is detected and what optimizations are applied
3. **Timeout tracking** - Detailed logging when timeouts occur with full context
4. **Error details** - Complete error information including stack traces
5. **Retry logic** - Track retry attempts and backoff strategies
6. **Response validation** - Log HTTP status codes and response sizes
7. **LOC-specific tracking** - Special attention to Library of Congress URLs and manifest loading
8. **Progress monitoring** - Track progress through multi-step operations
9. **Stall detection** - Identify when downloads are taking unusually long

The logging uses consistent prefixes ([methodName]) to make it easy to filter and track the flow through the system.