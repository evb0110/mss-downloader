# Manifest Cache System Analysis

## Overview
The manuscript downloader uses a persistent cache system for IIIF manifests to improve performance and reduce redundant network requests. The cache is implemented through the `ManifestCache` class and is used by `EnhancedManuscriptDownloaderService`.

## Cache Architecture

### 1. ManifestCache Service (`/src/main/services/ManifestCache.ts`)

**Key Features:**
- **Persistent Storage**: Stores manifests in JSON file at `userData/cache/manifests.json`
- **TTL**: 24-hour cache expiration (configurable via `maxAge`)
- **Version Control**: Uses `CACHE_VERSION = 4` to invalidate outdated cache formats
- **Domain-based Clearing**: Can clear cache entries for specific domains
- **Corruption Detection**: Validates manifest structure before caching/retrieval

**Cache Entry Structure:**
```typescript
{
  manifest: ManuscriptManifest,
  timestamp: number,
  version: number
}
```

**Key Methods:**
- `get(url)`: Retrieves cached manifest with validation
- `set(url, manifest)`: Stores manifest with validation
- `clearUrl(url)`: Removes specific URL from cache
- `clearDomain(domain)`: Removes all entries for a domain
- `clearProblematicUrls()`: Clears known problematic domains on startup
- `isValidManifest()`: Validates manifest structure

### 2. Integration in EnhancedManuscriptDownloaderService

**Cache Usage Pattern:**
```typescript
async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
    // 1. Check cache first
    const cachedManifest = await this.manifestCache.get(originalUrl);
    if (cachedManifest) {
        return cachedManifest;
    }
    
    // 2. Load from network
    const manifest = await this.loadFromNetwork(originalUrl);
    
    // 3. Cache the result
    await this.manifestCache.set(originalUrl, manifest);
    
    return manifest;
}
```

## Cache Management Features

### 1. Startup Cache Clearing
The service clears problematic domains on startup to ensure users get updated implementations:

```typescript
// In constructor:
this.manifestCache.clearProblematicUrls()
this.clearFlorenceCacheOnStartup()
this.clearGrazCacheOnStartup()
```

**Problematic domains cleared on startup:**
- `bl.digirati.io`
- `iiif.bl.uk`
- `www.loc.gov`
- `tile.loc.gov`
- `cdm21059.contentdm.oclc.org` (Florence)
- `unipub.uni-graz.at` (Graz)
- `gams.uni-graz.at` (Graz)

### 2. Error Recovery
When downloads fail, the cache is cleared to prevent corrupted data persistence:

```typescript
// In EnhancedDownloadQueue:
if (downloadFailed) {
    await this.manifestCache.clearUrl(item.url);
}
```

### 3. Cache Validation

**Manifest Validation Checks:**
- Must be a valid object
- Must have `pageLinks` array
- Page links must be valid strings
- No `undefined` or `null` in URLs
- Corrupted entries are automatically removed

### 4. Cache Key Generation
URLs are normalized to lowercase and special characters replaced with underscores:
```typescript
getCacheKey(url: string): string {
    return url.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
```

## HTTP Headers and Cache Control

All network requests include cache-busting headers:
```typescript
headers: {
    'Cache-Control': 'no-cache',
    // ... other headers
}
```

This ensures fresh data from servers despite local caching.

## SharedManifestAdapter Integration

The `SharedManifestAdapter` bridges shared manifest loaders with the Electron environment but doesn't implement its own caching - it relies on the main service's cache.

## Cache-Related Issues and Solutions

### 1. Version Incompatibility
- **Issue**: Cache format changes between versions
- **Solution**: `CACHE_VERSION` increments trigger automatic cache clearing

### 2. Corrupted Manifests
- **Issue**: Invalid manifest data causing parsing errors
- **Solution**: `isValidManifest()` validation before caching/retrieval

### 3. Library-Specific Issues
- **Issue**: Libraries change their API/format
- **Solution**: Domain-specific cache clearing on startup for known problematic libraries

### 4. Stale Data
- **Issue**: Cached data becomes outdated
- **Solution**: 24-hour TTL and manual clearing mechanisms

## Best Practices

1. **Always validate manifests** before caching
2. **Clear cache on errors** to prevent corruption persistence
3. **Version cache formats** to handle schema changes
4. **Use domain clearing** for library-specific issues
5. **Include cache-control headers** in HTTP requests
6. **Log cache operations** for debugging

## Performance Impact

- **Positive**: Reduces network requests for repeated downloads
- **Positive**: Faster manifest loading for cached entries
- **Negative**: Disk I/O for cache operations
- **Negative**: Memory usage for in-memory cache map

## Recommendations

1. Consider implementing cache size limits
2. Add cache statistics/monitoring
3. Implement selective cache warming for popular manuscripts
4. Consider using ETags for more intelligent cache invalidation
5. Add user-facing cache management options in settings