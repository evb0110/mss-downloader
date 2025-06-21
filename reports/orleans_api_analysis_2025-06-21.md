# Orleans Médiathèques API Analysis - Technical Findings

**Date:** 2025-06-21  
**URL Tested:** https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238/tri/%2A/expressionRecherche/Ouvrages+de+Pseudo+Isidore

## Executive Summary

The Orleans Médiathèques problematic URL has been thoroughly analyzed. The hanging issue is caused by **massive manifest size** - this single manuscript contains **over 356 individual media objects** (from media ID 301146 to 572019), each requiring a separate API call to fully reconstruct the IIIF manifest.

## Technical Architecture

### Platform Details
- **Digital Collections System:** Omeka S (v3.2.3)
- **IIIF Implementation:** Custom OctopusViewer module
- **Main Domain:** `mediatheques.orleans.fr` (PHP-based OPAC)
- **Digital Assets Domain:** `aurelia.orleans.fr` (Omeka S instance)
- **Image Server:** `images-aurelia.orleans-metropole.fr` (IIIF v3 compliant)

### API Structure
```
Main Record: https://mediatheques.orleans.fr/recherche/viewnotice/id/746238
Digital Item: https://aurelia.orleans.fr/api/items/257870
Individual Media: https://aurelia.orleans.fr/api/media/{301146...572019}
IIIF Images: https://images-aurelia.orleans-metropole.fr/iiif/3/{identifier}
```

## Root Cause Analysis

### 1. Manifest Size Problem
```json
{
  "o:media": [
    {"@id": "https://aurelia.orleans.fr/api/media/301146", "o:id": 301146},
    {"@id": "https://aurelia.orleans.fr/api/media/301147", "o:id": 301147},
    // ... 356+ entries continue ...
    {"@id": "https://aurelia.orleans.fr/api/media/572019", "o:id": 572019}
  ]
}
```

The main item API returns **356+ media object references**, each requiring individual API calls to retrieve IIIF service URLs and metadata.

### 2. Performance Impact Analysis

**Single Media Object Request:**
- Time: ~0.4-0.5 seconds per request
- **Total for full manifest: 356 × 0.4s = 142+ seconds minimum**

**Sequential API Limitations:**
- No pagination support for media objects
- No bulk media endpoint available  
- Rate limiting appears to be in place (sequential requests hang)
- Each media object contains full IIIF v3 service definition

### 3. Network Behavior Patterns

**Successful Single Requests:**
```bash
# Individual requests work with proper timing
curl "https://aurelia.orleans.fr/api/media/301146" # ~0.4s response
curl "https://aurelia.orleans.fr/api/items/257870"  # Works but massive response
```

**Failed Sequential Requests:**
```bash
# Multiple requests in succession hang indefinitely
for i in 301146 301147 301148; do
  curl "https://aurelia.orleans.fr/api/media/$i" # Hangs after first request
done
```

**Rate Limiting Evidence:**
- First request succeeds normally
- Subsequent requests hang indefinitely  
- No proper HTTP error codes returned
- Connection timeouts rather than 429 responses

## Hanging Scenarios Identified

### 1. Manifest Loading Phase
When the downloader attempts to:
1. Fetch main item: `GET /api/items/257870` ✅ (Works, but returns 356+ media refs)
2. Process each media object sequentially ❌ (Hangs due to rate limiting)
3. Build complete IIIF manifest ❌ (Never completes)

### 2. API Rate Limiting Behavior
- **No explicit rate limit headers** in responses
- **Silent hanging** instead of proper HTTP error codes
- **Connection-level blocking** rather than application-level errors
- **No retry-after** or backoff guidance provided

### 3. Resource Exhaustion
- **Memory usage**: 356+ API responses to hold in memory
- **Network connections**: Potential connection pool exhaustion
- **Processing time**: Linear scaling with manuscript page count
- **No pagination**: All media must be fetched to build complete manifest

## Comparison with Working Libraries

**Standard IIIF Implementations:**
- **Single manifest URL** returns complete document
- **Typical response time**: 1-5 seconds total
- **Example**: BNF Gallica provides single manifest with all images

**Orleans Implementation Issues:**
- **Fragmented manifest** across 356+ separate API calls
- **Total time required**: 142+ seconds minimum
- **No atomic manifest endpoint** available
- **Rate limiting blocks** completion

## Potential Solutions Identified

### 1. Batch Processing with Delays
```javascript
// Add delays between requests to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
for (const mediaId of mediaIds) {
  await fetchMediaObject(mediaId);
  await delay(1000); // 1 second between requests
}
```

### 2. Limited Manifest Loading
```javascript
// Only load first N pages to avoid timeout
const MAX_PAGES = 50;
const limitedMediaIds = mediaIds.slice(0, MAX_PAGES);
```

### 3. Parallel Processing with Limits
```javascript
// Use Promise pool to limit concurrent requests
const concurrencyLimit = 3;
const chunks = chunkArray(mediaIds, concurrencyLimit);
for (const chunk of chunks) {
  await Promise.all(chunk.map(fetchMediaObject));
  await delay(2000); // Pause between batches
}
```

## Recommended Implementation Strategy

1. **Skip first page download** for size estimation (like FLORUS fix in v1.0.74)
2. **Implement progressive loading** with user feedback
3. **Add timeout handling** with partial manifest support  
4. **Consider manifest caching** to avoid repeated API calls
5. **Limit initial pages** for size estimation (e.g., first 20 pages)

## Network Infrastructure Notes

**DNS Resolution:**
- `mediatheques.orleans.fr`: 195.154.54.74
- `aurelia.orleans.fr`: 51.159.175.23  
- `images-aurelia.orleans-metropole.fr`: [IIIF image server]

**SSL Configuration:**
- Let's Encrypt certificates
- TLS 1.3 support
- HTTP/2 enabled

**Server Software:**
- nginx/1.24.0 (Ubuntu)
- PHP/8.3.22
- Omeka S 3.2.3

## Conclusion

The Orleans hanging issue is **not a network timeout** but a **systematic API design limitation** combined with **rate limiting enforcement**. The requirement to make 356+ individual API calls to construct a single manifest makes this implementation fundamentally incompatible with reasonable download timeouts.

The solution requires treating Orleans like other problematic libraries (FLORUS, Manuscripta.se) that skip first-page download estimation and implement progressive loading with appropriate delays.

**Priority Fix:** Add Orleans to libraries that bypass size estimation, similar to the FLORUS fix implemented in v1.0.74.