# Critical Analysis: Why Graz Still Crashes Despite Error Handling

## The Problem
User reports app still crashes when loading Graz manuscripts, likely due to geo-restrictions. My error handling in v1.4.93 didn't prevent the crash.

## Why My Fix Failed

### 1. Wrong Code Path
**MY FIX:** Added error handling in `loadGrazManifest()` in `EnhancedManuscriptDownloaderService.ts`

**ACTUAL CODE PATH:** 
```
case 'graz':
    manifest = await this.sharedManifestAdapter.getManifestForLibrary('graz', originalUrl);
```

The code **never calls** `loadGrazManifest()` anymore! It uses `SharedManifestAdapter` instead.

### 2. Error Propagation Chain
The actual error flow when Graz fails:

1. **SharedManifestLoaders.js** → `getGrazManifest(url)` throws error
2. **SharedManifestAdapter.ts** → catches but **re-throws** error:
   ```typescript
   } catch (error) {
       console.error(`SharedManifestAdapter error for ${libraryId}:`, error);
       throw error;  // ← Re-throws!
   }
   ```
3. **EnhancedManuscriptDownloaderService.ts** → `loadManifest()` catches but **re-throws**:
   ```typescript
   } catch (error: any) {
       console.error(`Failed to load manifest: ${(error as Error).message}`);
       // ... some Graz-specific messages ...
       throw error;  // ← Re-throws again!
   }
   ```
4. **main.ts** → IPC handler catches but **re-throws**:
   ```typescript
   } catch (error: any) {
       comprehensiveLogger.log({ ... });
       throw error;  // ← Re-throws to renderer!
   }
   ```
5. **Renderer** → Actually handles the error properly:
   ```typescript
   } catch (error: any) {
       await window.electronAPI.updateQueueItem(tempId, {
           status: 'failed',
           error: error.message
       });
   }
   ```

### 3. The Real Crash Location

The crash likely happens in one of these places:

#### A. SharedManifestLoaders.js (Most Likely)
In `getGrazManifest()`, there might be an **unhandled async operation** or **uncaught promise rejection**:
- Network timeout without proper error handling
- JSON parsing failure on malformed response
- Accessing undefined properties when geo-blocked

#### B. IPC Serialization
If the error object contains **non-serializable data** (circular references, functions), IPC might crash when trying to send it to renderer.

#### C. Electron Process Crash
A severe network error (ECONNREFUSED, ETIMEDOUT) might crash the **main process** before error handlers can catch it.

## Why I Claimed It Was Fixed

1. **I tested locally** where Graz IS accessible - manifest loaded successfully
2. **I added error handling** but in the WRONG function (`loadGrazManifest` instead of the adapter)
3. **I didn't test geo-restriction scenario** where Graz returns 403/blocked response

## The Real Fix Needed

### 1. Fix SharedManifestAdapter Error Handling
```typescript
// SharedManifestAdapter.ts
} catch (error: any) {
    console.error(`SharedManifestAdapter error for ${libraryId}:`, error);
    
    // Create a safe, serializable error
    const safeError = new Error(
        `Failed to load ${libraryId} manifest: ${error.message || 'Unknown error'}`
    );
    safeError.name = 'ManifestLoadError';
    
    // Don't re-throw original error with potential circular refs
    throw safeError;
}
```

### 2. Fix SharedManifestLoaders.js
Add try-catch around ALL async operations in `getGrazManifest()`:
```javascript
async getGrazManifest(url) {
    try {
        // ... existing code ...
    } catch (error) {
        console.error('[Graz] Manifest loading failed:', error);
        
        // Return safe error, don't let it propagate uncaught
        throw new Error(`Graz manifest unavailable: ${error.message || 'Network error'}`);
    }
}
```

### 3. Add Process-Level Error Handlers
In main.ts, add uncaught exception handlers:
```typescript
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log to file, don't crash
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Log to file, don't crash
});
```

## Testing Required

### Geo-Restriction Test
1. Block Graz domain in hosts file or firewall
2. Try loading: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
3. Should show "Failed to load" in queue, NOT crash app

### Network Failure Test
1. Disconnect network
2. Try loading Graz URL
3. Should timeout gracefully, NOT crash

### Malformed Response Test
1. Mock Graz to return HTML instead of JSON
2. Should show parse error, NOT crash

## Conclusion

My "fix" was ineffective because:
1. I fixed the wrong code path
2. Errors are re-thrown at every level
3. No process-level crash protection
4. Didn't test the actual failure scenario (geo-blocking)

The app crashes because an **unhandled error** in SharedManifestLoaders.js propagates through the entire chain without proper sanitization, likely containing non-serializable data or causing an uncaught promise rejection.