# Bordeaux Library Implementation Failure Analysis

## Executive Summary

The Bordeaux library implementation in v1.4.48 has critical architectural gaps that prevent it from functioning in production. While the manifest loading and tile URL generation work correctly, the actual tile downloading and assembly pipeline is completely missing from the main download service.

## Critical Issues Identified

### 1. Missing Tile Processing Integration (CRITICAL)

**Location**: `src/main/services/EnhancedManuscriptDownloaderService.ts`

The `downloadManuscript` method has no logic to handle tile-based manifests. When Bordeaux returns a manifest with:
- `type: 'tiles'`
- `requiresTileAssembly: true`
- `processorType: 'DirectTileProcessor'`

The service treats it like a regular image manifest and tries to download the base tile URL as if it were a complete image, which fails.

**Expected behavior**: The service should detect tile-based manifests and use DirectTileProcessor to download and assemble tiles.

**Actual behavior**: The service ignores the tile metadata and fails when trying to download non-existent full images.

### 2. Disconnected Tile Processing Components

**Components present but not integrated**:
1. `DirectTileProcessor.ts` (lines 1-356) - Complete tile download and assembly logic
2. `TileEngineService.ts` - Advanced tile engine infrastructure
3. `SharedManifestLoaders.js` (lines 1922-2065) - Correct Bordeaux manifest generation

**Issue**: These components exist but are never called from the main download flow.

### 3. Switch Case Implementation (Fixed in v1.4.47)

**Location**: `src/main/services/EnhancedManuscriptDownloaderService.ts` (line ~1345)

The switch case was added correctly in v1.4.47:
```typescript
case 'bordeaux':
    manifest = await this.sharedManifestAdapter.getManifestForLibrary('bordeaux', originalUrl);
    break;
```

This part works correctly and loads the manifest with proper tile metadata.

### 4. Manifest Structure Issues

**Location**: `src/shared/SharedManifestLoaders.js` (lines 1922-2065)

The Bordeaux manifest loader correctly:
- Parses public and direct tile URLs
- Extracts manuscript IDs and page numbers
- Generates tile base URLs
- Sets tile metadata (tileSize: 256, overlap: 1, format: 'jpg')

However, the manifest structure with nested `tileInfo` objects is not handled by the download service.

## Root Cause Analysis

The implementation follows a two-phase approach:
1. **Phase 1**: Manifest loading (working) - Added switch case, URL parsing, tile URL generation
2. **Phase 2**: Tile processing (missing) - Should integrate DirectTileProcessor into download flow

The v1.4.48 fixes focused on cache clearing and reliability improvements but didn't address the fundamental architectural gap.

## Specific Code References

### 1. Missing Integration Point
**File**: `src/main/services/EnhancedManuscriptDownloaderService.ts`
**Method**: `downloadManuscript` (line ~3763)
**Issue**: No check for `manifest.type === 'tiles'` or `manifest.requiresTileAssembly`

### 2. Unused Tile Processor
**File**: `src/main/services/DirectTileProcessor.ts`
**Methods**: 
- `processTiledImage` (line 315) - Main entry point
- `probeTileStructure` (line 79) - Tile discovery
- `downloadTiles` (line 198) - Batch download
- `stitchTiles` (line 243) - Image assembly

These methods are never called.

### 3. Adapter Bridge Gap
**File**: `src/main/services/SharedManifestAdapter.ts`
**Lines**: 47-52
The adapter correctly preserves tile metadata:
```javascript
if (result.type === 'tiles' || result.type === 'dzi') {
    (manifest as any).type = result.type;
    (manifest as any).requiresTileAssembly = result.requiresTileAssembly;
    (manifest as any).processorType = result.processorType;
    (manifest as any).images = result.images;
}
```

But this metadata is ignored downstream.

## Why Production Fails

1. **User clicks download** → Manifest loads successfully
2. **Download starts** → Service tries to download tile base URLs as images
3. **HTTP requests fail** → Base URLs like `https://selene.bordeaux.fr/in/dz/330636101_MS0778_0006` return 404
4. **No fallback** → Service doesn't recognize this as a tile URL needing special processing
5. **Download fails** → User sees error about failed image downloads

## Test Script Success vs Production Failure

Test scripts work because they:
1. Directly instantiate `DirectTileProcessor`
2. Manually handle tile URLs
3. Don't go through `EnhancedManuscriptDownloaderService`

Production fails because:
1. The main service doesn't know about tile processing
2. No integration between manifest loading and tile downloading
3. Tile metadata is loaded but ignored

## Recommendations

### Immediate Fix Required

Add tile processing logic to `EnhancedManuscriptDownloaderService.downloadManuscript`:

```typescript
// After manifest is loaded, check if it requires tile assembly
if ((manifest as any).requiresTileAssembly && (manifest as any).processorType === 'DirectTileProcessor') {
    // Use DirectTileProcessor instead of regular image download
    const processor = new DirectTileProcessor();
    // Process each page's tiles
    for (const image of (manifest as any).images) {
        const buffer = await processor.processTiledImage(image.url, image.tileInfo);
        // Save buffer as image file
    }
}
```

### Architecture Issues

1. **Tight coupling**: Tile processing should be abstracted
2. **Missing interface**: Need a common interface for different image processors
3. **Error handling**: No graceful degradation for tile failures
4. **Performance**: No concurrent tile downloading across pages

## Conclusion

The Bordeaux implementation is architecturally incomplete. While manifest loading works perfectly, the actual tile downloading and assembly pipeline is missing from the production code path. This explains why v1.4.48 "fixes" didn't resolve the issue - they addressed peripheral concerns (cache clearing, retries) but not the core architectural gap.

The fix requires integrating DirectTileProcessor into the main download flow when tile-based manifests are detected.