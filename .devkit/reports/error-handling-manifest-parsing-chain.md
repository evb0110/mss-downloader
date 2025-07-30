# Error Handling in Manifest Parsing Chain

## Overview

This report examines the error handling flow from initial URL parsing to final response in the manuscript downloader application.

## Error Flow Architecture

### 1. Frontend Layer (DownloadQueueManager.vue)

**Entry Point**: `processBulkUrls()` function
- Parses URLs from user input
- Handles bulk URL processing with duplicate detection
- Creates temporary queue items with 'loading' status
- Calls `parseManuscriptWithCaptcha()` for each URL

**Error Handling**:
```typescript
async function parseManuscriptWithCaptcha(url: string) {
    try {
        return await window.electronAPI.parseManuscriptUrl(url);
    } catch (error: any) {
        // Special handling for CAPTCHA errors
        if (error.message?.includes('CAPTCHA_REQUIRED:')) {
            // Extract captcha URL and solve it
            // Then retry manifest parsing
        }
        throw error; // Re-throw other errors
    }
}
```

**Bulk Processing Error Recovery**:
- Tracks `errorCount`, `duplicateCount`, and `addedCount`
- Updates failed items with error status and message
- Shows aggregate error message to user
- Expected errors (404, CORS, invalid manifest) are handled silently
- Unexpected errors are logged to console

### 2. IPC Layer (main.ts)

**Handler**: `ipcMain.handle('parse-manuscript-url')`
```typescript
ipcMain.handle('parse-manuscript-url', async (_event, url: string) => {
  if (!enhancedManuscriptDownloader) {
    throw new Error('Enhanced manuscript downloader not initialized');
  }
  
  try {
    return await enhancedManuscriptDownloader.loadManifest(url);
  } catch (error: any) {
    // Special handling for captcha errors
    if (error.message?.startsWith('CAPTCHA_REQUIRED:')) {
      throw error; // Pass through to UI for captcha handling
    }
    throw error; // Handle other errors normally
  }
});
```

### 3. Service Layer (EnhancedManuscriptDownloaderService.ts)

**Main Method**: `loadManifest()`

**Error Handling Features**:
1. **Cache-First Strategy**: 
   - Checks ManifestCache before parsing
   - Returns cached manifest if valid and not expired

2. **Library Detection**:
   - Detects library type from URL
   - Throws error for unsupported libraries
   - Special error for Trinity College Dublin (captcha-protected)

3. **Library-Specific Parsing**:
   - Routes to appropriate parser based on library
   - Each library has its own error handling

4. **Enhanced Network Error Handling**:
```typescript
catch (error: any) {
    console.error(`Failed to load manifest: ${(error as Error).message}`);
    
    // Special handling for Graz timeouts
    if (error.code === 'ETIMEDOUT' && originalUrl.includes('unipub.uni-graz.at')) {
        throw new Error(`University of Graz connection timeout...`);
    }
    
    if (error.code === 'ECONNRESET' && originalUrl.includes('unipub.uni-graz.at')) {
        throw new Error(`University of Graz connection was reset...`);
    }
    
    if (error.message?.includes('timeout') && originalUrl.includes('unipub.uni-graz.at')) {
        throw new Error(`University of Graz request timed out...`);
    }
    
    throw error;
}
```

### 4. Shared Manifest Adapter (SharedManifestAdapter.ts)

**Purpose**: Bridge between Electron and shared Node.js manifest loaders

**Error Handling**:
```typescript
async getManifestForLibrary(libraryId: string, url: string): Promise<ManuscriptManifest> {
    try {
        await this.initializeSharedLoaders();
        const result = await this.sharedLoaders.getManifestForLibrary(libraryId, url);
        
        // Convert shared loader format to Electron format
        const manifest: ManuscriptManifest = {
            pageLinks: result.images.map((image: any) => image.url),
            totalPages: result.images.length,
            library: libraryId as any,
            displayName: result.displayName || `${libraryId} Manuscript`,
            originalUrl: url
        };
        
        return manifest;
    } catch (error) {
        console.error(`SharedManifestAdapter error for ${libraryId}:`, error);
        throw error; // Propagate error up the chain
    }
}
```

### 5. Shared Manifest Loaders (SharedManifestLoaders.js)

**Retry Logic with Exponential Backoff**:
```javascript
async defaultNodeFetch(url, options = {}, retries = 3) {
    // Special handling for Verona - increase retries to 15
    if (url.includes('nuovabibliotecamanoscritta.it')) {
        retries = 15;
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            return await this.fetchUrl(url, options);
        } catch (error) {
            if (i === retries - 1) {
                // Enhanced error message for Verona timeouts
                if (url.includes('nuovabibliotecamanoscritta.it') && 
                    error.code === 'ETIMEDOUT') {
                    throw new Error(`Verona server is not responding after ${retries} attempts...`);
                }
                throw error;
            }
            
            // Exponential backoff with jitter
            let delay = calculateExponentialDelay(i);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

### 6. Cache Layer (ManifestCache.ts)

**Error Resilience**:
1. **Non-Blocking Cache Errors**:
   - Cache read/write failures don't stop manifest loading
   - Errors are logged but not propagated
   
2. **Cache Validation**:
   - Validates manifest structure before caching
   - Removes corrupted entries automatically
   
3. **Domain-Specific Clearing**:
   - Can clear problematic domains on startup
   - Currently clears Florence and Graz caches automatically

## Key Error Scenarios

### 1. Network Timeouts
- **Detection**: Error code `ETIMEDOUT` or timeout in message
- **Handling**: Library-specific messages with retry suggestions
- **Special Cases**: Graz and Verona get extended timeouts and retries

### 2. Authentication/Session Errors
- **Detection**: "Preview non disponibile" or similar in response
- **Handling**: Internet Culturale has special validation for auth errors
- **Recovery**: User advised to retry or check library website

### 3. CAPTCHA Requirements
- **Detection**: `CAPTCHA_REQUIRED:` prefix in error message
- **Handling**: Error bubbles up to UI for user interaction
- **Recovery**: UI shows captcha solver, then retries

### 4. Invalid Manifest Structure
- **Detection**: Missing required fields or malformed data
- **Handling**: Specific error messages per library
- **Recovery**: Cache is not updated with invalid data

### 5. Unsupported Libraries
- **Detection**: URL doesn't match any known pattern
- **Handling**: Clear error message with URL shown
- **Recovery**: User must use supported library

## Error Message Guidelines

1. **User-Friendly Messages**: Technical errors are translated to user-understandable text
2. **Actionable Advice**: Include suggestions (retry, check website, etc.)
3. **Context Preservation**: Original URL and library name included
4. **Progressive Disclosure**: Technical details in console, summary in UI

## Recommendations for Improvement

1. **Standardize Error Codes**: Use consistent error codes across all libraries
2. **Implement Circuit Breaker**: Temporarily disable problematic libraries
3. **Add Error Metrics**: Track error rates per library for monitoring
4. **Enhance Retry Strategy**: Make retry configuration library-specific
5. **Improve Error Recovery**: Add automatic cache clearing on specific errors
6. **User Error Reporting**: Add mechanism for users to report persistent errors

## Conclusion

The error handling chain is well-structured with multiple layers of protection:
- Frontend gracefully handles bulk errors
- IPC layer preserves special error types
- Service layer adds library-specific context
- Shared loaders implement robust retry logic
- Cache layer prevents corruption propagation

The system prioritizes user experience by providing clear, actionable error messages while maintaining detailed technical logs for debugging.