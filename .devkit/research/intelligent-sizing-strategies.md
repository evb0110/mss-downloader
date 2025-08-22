# Intelligent Image Sizing Strategies in MSS Downloader

## Overview

Based on comprehensive analysis of 40+ library loaders in the codebase, this guide documents proven strategies for intelligent image sizing, server limitation handling, and adaptive fallback mechanisms. These patterns can be directly applied to improve Florence manuscript downloads and other ContentDM systems.

## Table of Contents

1. [Size Parameter Strategies](#size-parameter-strategies)
2. [Fallback Mechanisms](#fallback-mechanisms)
3. [Server Limitation Detection](#server-limitation-detection)
4. [Binary Search Page Discovery](#binary-search-page-discovery)
5. [ContentDM Specific Patterns](#contentdm-specific-patterns)
6. [URL Validation and Testing](#url-validation-and-testing)
7. [Retry and Rate Limiting](#retry-and-rate-limiting)
8. [Implementation Recommendations](#implementation-recommendations)

---

## Size Parameter Strategies

### 1. Multiple Resolution Strategies (MDC Catalonia Approach)

**Best Practice**: Test multiple resolution parameters in priority order

```typescript
// From MdcCataloniaLoader.ts (lines 98-103)
const resolutionStrategies = [
    'full/full',  // Highest quality
    'full/max',   // Same as full/full (alternative)  
    'full/800,'   // Fallback resolution (reduced quality)
];

for (const resolution of resolutionStrategies) {
    const candidateUrl = `https://server.com/iiif/${collection}/${pageId}/${resolution}/0/default.jpg`;
    
    // Quick validation with HEAD request
    const headResponse = await this.deps.fetchDirect(candidateUrl, { method: 'HEAD' });
    
    if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
        successfulUrl = candidateUrl;
        console.log(`✅ Page ${pageNum}: ${resolution} validated`);
        break; // Use first working resolution
    }
}
```

**Key Insights:**
- Always test highest resolution first (`full/full` or `full/max`)
- Provide reasonable fallback resolutions (`full/800,`, `full/2000,`)
- Stop at first successful resolution to minimize server load
- Use HEAD requests for quick validation

### 2. Content-Type Based Sizing (Gallica Approach)

**Best Practice**: Adapt size parameters based on content type

```typescript
// From GallicaLoader.ts (lines 258-274)
private getIIIFParameters(contentType: string): string {
    switch (contentType) {
        case 'manuscript':
            return '/full/max/0/default.jpg'; // Highest quality for manuscripts
        case 'book':
        case 'periodical':
            return '/full/2000,/0/default.jpg'; // High quality but manageable size
        case 'map':
            return '/full/full/0/default.jpg'; // Full resolution for maps
        case 'image':
            return '/full/1500,/0/default.jpg'; // Medium-high quality for images
        case 'serial':
            return '/full/1200,/0/default.jpg'; // Medium quality for serials
        default:
            return '/full/max/0/default.jpg';
    }
}
```

**Key Insights:**
- Manuscripts typically need highest resolution (`full/max`)
- Books and periodicals can use constrained widths (`full/2000,`)
- Maps require full resolution for readability
- Adapt strategy based on material type

### 3. Server-Specific Sizing (Florence Approach)

**Best Practice**: Hard-code proven maximum sizes for specific servers

```typescript
// From FlorenceLoader.ts (line 239)
const pageLinks = pages.map(page => {
    // Florence supports up to 6000px width
    return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`;
});
```

**Key Insights:**
- Research server capabilities beforehand
- Florence ContentDM supports up to 6000px width
- Use proven maximum rather than generic `full/max`
- Document server-specific limits in comments

---

## Fallback Mechanisms

### 1. Multi-Strategy Loading (Gallica Approach)

**Best Practice**: Implement multiple loading strategies with graceful fallback

```typescript
// From GallicaLoader.ts (lines 59-88)
const strategies = [
    () => this.tryIIIFManifest(arkId, contentInfo, gallicaUrl),
    () => this.tryDirectImageAccess(arkId, contentInfo, gallicaUrl),
    () => this.tryFallbackFormats(arkId, contentInfo, gallicaUrl)
];

for (const strategy of strategies) {
    try {
        const result = await strategy();
        if (result && result.totalPages > 0) {
            this.deps.logger?.log({
                level: 'info',
                library: 'gallica',
                message: `Success with ${result.totalPages} pages`,
                details: { totalPages: result.totalPages, strategy: 'successful' }
            });
            return result;
        }
    } catch (error) {
        this.deps.logger?.log({
            level: 'warn',
            library: 'gallica',
            message: `Strategy failed: ${error.message}`,
            details: { error: error.message }
        });
    }
}
```

**Key Insights:**
- Try IIIF manifest first (most reliable)
- Fall back to direct image access
- Final fallback to alternative formats
- Log failures but continue to next strategy

### 2. Format-Based Fallback (Gallica Approach)

**Best Practice**: Test multiple image formats when primary fails

```typescript
// From GallicaLoader.ts (lines 311-320)
const fallbackFormats = ['.item', '.highres', '.zoom', '.medres', '.lowres'];

for (const format of fallbackFormats) {
    try {
        const pageCount = await this.discoverPageCount(arkId, format);
        if (pageCount > 0) {
            const pageLinks = [];
            for (let i = 1; i <= pageCount; i++) {
                pageLinks.push(`https://gallica.bnf.fr/${arkId}/f${i}${format}`);
            }
            return { pageLinks, totalPages: pageCount, ... };
        }
    } catch (error) {
        // Log and continue to next format
    }
}
```

**Key Insights:**
- Order formats by preference (`.item`, `.highres`, etc.)
- Each format may have different size capabilities
- Test actual page count for each format
- Use first successful format

### 3. IIIF Version Fallback (GenericIiifLoader Approach)

**Best Practice**: Support both IIIF v2 and v3 with automatic detection

```typescript
// From GenericIiifLoader.ts (lines 33-45)
let canvases: Record<string, unknown>[] = [];

if (manifest.items && Array.isArray(manifest.items)) {
    // IIIF v3: canvases are directly in manifest.items
    canvases = manifest.items;
} else if (manifest.sequences && Array.isArray(manifest.sequences)) {
    // IIIF v2: canvases are in sequences
    for (const sequence of manifest.sequences) {
        const sequenceCanvases = sequence.canvases || [];
        canvases.push(...sequenceCanvases);
    }
} else {
    // Fallback: try to find canvases in the manifest itself
    canvases = manifest.canvases || [];
}
```

**Key Insights:**
- Try IIIF v3 structure first (`items`)
- Fall back to IIIF v2 structure (`sequences`)
- Final fallback to direct canvas array
- Handle different property names across versions

---

## Server Limitation Detection

### 1. HTTP Status Code Interpretation

**Best Practice**: Handle different error codes appropriately

```typescript
// From MdcCataloniaLoader.ts (lines 120-130)
if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
    successfulUrl = candidateUrl;
    console.log(`✅ Page ${page.index}: ${page.title} - ${resolution} validated`);
    break; // Use first working resolution
}

// From GallicaLoader.ts (lines 368-372)
if (response.status === 400) {
    // 400 might indicate format not supported for this content
    throw new Error(`Format ${format} not supported (HTTP 400)`);
}
```

**Key Insights:**
- **200 + image content-type**: Image exists and is accessible
- **400**: Format likely not supported by server
- **404**: Image doesn't exist (normal for page count discovery)
- **429**: Rate limiting (implement exponential backoff)
- **5xx**: Server errors (implement retry logic)

### 2. Content-Type Validation

**Best Practice**: Verify actual image content, not just HTTP 200

```typescript
// From MdcCataloniaLoader.ts (line 121)
if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
    // Only consider this successful if content-type indicates an image
    successfulUrl = candidateUrl;
    break;
}
```

**Key Insights:**
- HTTP 200 doesn't guarantee image content
- Check `content-type` header contains "image"
- Some servers return HTML error pages with 200 status

### 3. Consecutive Error Tracking

**Best Practice**: Stop processing after too many consecutive failures

```typescript
// From MdcCataloniaLoader.ts (lines 137-143)
consecutiveErrors++;

if (consecutiveErrors >= maxConsecutiveErrors) {
    throw new Error(`Too many consecutive failures (${consecutiveErrors}). Archive may be temporarily unavailable.`);
}
```

**Key Insights:**
- Track consecutive failures, not total failures
- Set reasonable limits (10-20 consecutive failures)
- Distinguish between transient and permanent failures
- Provide helpful error messages about server availability

---

## Binary Search Page Discovery

### 1. Exponential + Binary Search (BNE Approach)

**Best Practice**: Combine exponential search with binary search for efficiency

```typescript
// From BneLoader.ts - Smart page discovery pattern
private async smartPageDiscovery(manuscriptId: string): Promise<number> {
    console.log('BNE: Using smart exponential + binary search for page discovery...');
    
    // First, check if page 1 exists
    const page1Exists = await this.checkPageExists(manuscriptId, 1);
    if (!page1Exists) {
        return 0;
    }
    
    // Exponential search to find upper bound
    let upperBound = 1;
    while (await this.checkPageExists(manuscriptId, upperBound)) {
        upperBound *= 2; // 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024...
        if (upperBound > 10000) { // Safety limit
            break;
        }
    }
    
    // Binary search between upperBound/2 and upperBound
    let low = Math.floor(upperBound / 2);
    let high = upperBound;
    
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const exists = await this.checkPageExists(manuscriptId, mid);
        
        if (exists) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    
    return low;
}
```

**Key Insights:**
- Start with exponential search to find rough upper bound
- Use binary search for precise page count
- Include safety limits to prevent infinite loops
- Very efficient for manuscripts of any size

### 2. GET vs HEAD Request Strategy (Rome Approach)

**Best Practice**: Use GET requests when HEAD requests are unreliable

```typescript
// From RomeLoader.ts - GET-based binary search
private async samplePagesWithGet(collectionType: string, manuscriptId: string): Promise<number> {
    console.log(`[Rome] Using GET-based binary search for accurate page detection...`);
    
    // Rome-specific: HEAD requests don't provide Content-Length for phantom pages
    // GET requests properly distinguish real vs phantom pages
    
    let low = 1;
    let high = 1000; // Start with reasonable upper bound
    
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const exists = await this.checkPageExists(collectionType, manuscriptId, mid);
        
        if (exists) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    
    return low;
}
```

**Key Insights:**
- Some servers (like Rome) have unreliable HEAD responses
- GET requests may be more accurate for page existence
- Document server-specific quirks in comments
- Consider bandwidth impact of GET vs HEAD

### 3. Gallica Binary Search Pattern

**Best Practice**: Efficient binary search with error handling

```typescript
// From GallicaLoader.ts (lines 350-382)
private async discoverPageCount(arkId: string, format: string): Promise<number> {
    let low = 1;
    let high = 1000; // reasonable upper bound
    let lastValidPage = 0;
    
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testUrl = `https://gallica.bnf.fr/${arkId}/f${mid}${format}`;
        
        try {
            const response = await this.deps.fetchDirect(testUrl, { method: 'HEAD' });
            if (response.ok) {
                lastValidPage = mid;
                low = mid + 1;
            } else if (response.status === 404) {
                high = mid - 1;
            } else if (response.status === 400) {
                throw new Error(`Format ${format} not supported (HTTP 400)`);
            } else {
                high = mid - 1;
            }
        } catch (error) {
            if (error.message.includes('not supported')) {
                throw error; // Propagate format not supported errors
            }
            high = mid - 1;
        }
    }
    
    return lastValidPage;
}
```

**Key Insights:**
- Track `lastValidPage` to handle edge cases
- Handle specific HTTP status codes appropriately
- Propagate format errors but catch network errors
- Set reasonable initial upper bounds (1000 is usually sufficient)

---

## ContentDM Specific Patterns

### 1. XML Structure Parsing (MDC Catalonia)

**Best Practice**: Use compound object XML for reliable page discovery

```typescript
// From MdcCataloniaLoader.ts (lines 25-45)
// Step 1: Get ContentDM compound object structure (most reliable method)
const compoundXmlUrl = `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${parentId}`;

const xmlResponse = await this.deps.fetchDirect(compoundXmlUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/xml, text/xml, */*',
        'Referer': originalUrl
    }
});

const xmlText = await xmlResponse.text();

// Parse XML to extract all page pointers
const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
```

**Key Insights:**
- ContentDM provides `/utils/getfile` XML endpoint
- XML contains definitive page structure
- More reliable than guessing page count
- Extract actual page pointers, not sequential numbers

### 2. Page Pointer Extraction

**Best Practice**: Parse XML structure to get actual page identifiers

```typescript
// From MdcCataloniaLoader.ts (lines 53-77)
const pages: Array<{
    index: number;
    title: string;
    filename: string;
    pagePtr: string;
}> = [];

for (let i = 0; i < pageMatches.length; i++) {
    const pageXml = pageMatches[i];
    
    const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
    const fileMatch = pageXml.match(/<pagefile>(.*?)<\/pagefile>/);
    const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);
    
    if (titleMatch && fileMatch && ptrMatch) {
        pages.push({
            index: i + 1,
            title: titleMatch[1] || '',
            filename: fileMatch[1] || '', // Actual filename from server
            pagePtr: ptrMatch[1] || ''   // Actual page pointer for IIIF
        });
    }
}
```

**Key Insights:**
- Extract actual filenames, don't assume patterns
- Use `pagePtr` for IIIF URLs, not sequential numbering
- Validate all required fields exist before adding page
- Handle malformed XML gracefully

### 3. Florence __INITIAL_STATE__ Pattern

**Best Practice**: Extract JavaScript state for ContentDM metadata

```typescript
// From FlorenceLoader.ts (lines 89-114)
// Extract __INITIAL_STATE__ from the HTML
const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
if (!stateMatch) {
    throw new Error('Could not find __INITIAL_STATE__ in Florence page');
}

// Unescape the JSON string
const escapedJson = stateMatch[1];
const unescapedJson = escapedJson
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u002F/g, '/');

let state: FlorenceState;
try {
    state = JSON.parse(unescapedJson);
} catch {
    throw new Error('Could not parse Florence page state');
}
```

**Key Insights:**
- ContentDM stores page structure in JavaScript state
- Requires careful JSON unescaping
- Provides complete page hierarchy and metadata
- More reliable than HTML scraping

---

## URL Validation and Testing

### 1. HEAD Request Validation

**Best Practice**: Use HEAD requests for quick URL testing

```typescript
// From MdcCataloniaLoader.ts (lines 111-125)
try {
    const headResponse = await this.deps.fetchDirect(candidateUrl, {
        method: 'HEAD',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': originalUrl
        }
    });
    
    // For MDC, if we get 200 + image content-type, the image exists
    if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
        successfulUrl = candidateUrl;
        break;
    }
} catch {
    // Continue to next resolution strategy
    continue;
}
```

**Key Insights:**
- HEAD requests are faster than GET for validation
- Check both status code AND content-type
- Include proper headers (User-Agent, Accept, Referer)
- Handle network errors gracefully

### 2. Server Delay Management

**Best Practice**: Add delays between requests to avoid overwhelming servers

```typescript
// From MdcCataloniaLoader.ts (line 156)
// Small delay to be respectful to the server
await new Promise(resolve => setTimeout(resolve, 150));
```

**Key Insights:**
- Add 100-200ms delays between validation requests
- Prevents overwhelming servers with rapid requests
- Shows respect for server resources
- May be required by some servers' rate limiting

### 3. URL Pattern Validation

**Best Practice**: Validate URL patterns before processing

```typescript
// From MorganLoader.ts (lines 75-84)
// CRITICAL VALIDATION: Ensure manuscriptId doesn't contain URLs
if (manuscriptId.includes('://') || manuscriptId.includes('http')) {
    console.error(`Morgan: Invalid manuscriptId detected: ${manuscriptId}`);
    throw new Error(`Morgan: Malformed URL - manuscriptId contains URL fragments: ${manuscriptId}`);
}

if (manuscriptId.length > 100) {
    console.error(`Morgan: Suspiciously long manuscriptId: ${manuscriptId}`);
    throw new Error(`Morgan: Malformed URL - manuscriptId too long: ${manuscriptId.length} chars`);
}
```

**Key Insights:**
- Validate extracted IDs don't contain URL fragments
- Check for reasonable length limits
- Prevent URL concatenation bugs
- Provide clear error messages for debugging

---

## Retry and Rate Limiting

### 1. Exponential Backoff with Jitter (LoC Approach)

**Best Practice**: Implement sophisticated retry logic for rate-limited servers

```typescript
// From LocLoader.ts (lines 283-297)
if (response.status === 429) {
    if (attempt >= maxAttempts) {
        throw new Error(`LoC rate limit exceeded after ${maxAttempts} attempts`);
    }
    
    // Exponential backoff with jitter: 3s, 6s, 12s, 24s, 48s, 96s, 192s, 384s
    const baseDelay = 3 * Math.pow(2, attempt - 1);
    // Add random jitter (±20%) to avoid synchronized retries
    const jitter = 0.2 * baseDelay * (Math.random() * 2 - 1);
    const delaySeconds = Math.max(1, baseDelay + jitter);
    
    console.log(`[fetchWithRateLimit] HTTP 429 detected - waiting ${delaySeconds.toFixed(1)}s before retry ${attempt + 1}/${maxAttempts}`);
    
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    return this.fetchWithRateLimit(url, attempt + 1, maxAttempts);
}
```

**Key Insights:**
- Exponential backoff prevents overwhelming servers
- Jitter prevents synchronized retry storms
- Different delays for different error types
- Clear logging of retry attempts

### 2. Server Error Retry (IRHT Approach)

**Best Practice**: Retry on server errors but not client errors

```typescript
// From IrhtLoader.ts (lines 83-93)
// Only retry for server errors (5xx), not client errors (4xx)
if ((error as Error).message.includes('500') && attempt < 3) {
    const retryDelay = this.calculateRetryDelay(attempt);
    console.warn(`IRHT attempt ${attempt} failed with server error, retrying in ${retryDelay}ms...`);
    await this.deps.sleep(retryDelay);
    continue;
} else {
    // Don't retry for client errors or final attempt
    throw error;
}
```

**Key Insights:**
- Retry server errors (5xx) - these may be transient
- Don't retry client errors (4xx) - these are likely permanent
- Implement retry delay calculation
- Limited number of retry attempts (usually 3)

### 3. Retry Delay Calculation

**Best Practice**: Calculate retry delays with exponential backoff

```typescript
// From IrhtLoader.ts (lines 102-107)
private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds max
    // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
    return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}
```

**Key Insights:**
- Start with reasonable base delay (1 second)
- Double delay with each attempt
- Cap maximum delay to prevent excessive waits
- Use powers of 2 for clean exponential progression

---

## Implementation Recommendations

### For Florence/ContentDM Systems:

1. **Multi-Resolution Strategy**: Implement the MDC Catalonia pattern with `['full/full', 'full/max', 'full/6000,', 'full/4000,', 'full/2000,']`

2. **XML Structure Discovery**: Use ContentDM's `/utils/getfile` endpoint to get definitive page structure

3. **Page Pointer Extraction**: Don't assume sequential numbering - extract actual page pointers from XML

4. **HEAD Request Validation**: Test each resolution with HEAD requests and content-type checking

5. **Consecutive Error Handling**: Stop processing after 10-15 consecutive failures

### For IIIF Systems:

1. **Version Fallback**: Support both IIIF v2 and v3 manifest structures

2. **Service URL Extraction**: Extract IIIF Image API service URLs from manifests

3. **Size Parameter Adaptation**: Use content-type aware sizing (manuscripts = `full/max`, books = `full/2000,`)

4. **Binary Search Discovery**: Implement exponential + binary search for unknown page counts

### For Rate-Limited Systems:

1. **Exponential Backoff**: Implement sophisticated retry logic with jitter

2. **Request Delays**: Add 150-300ms delays between requests

3. **Error Code Handling**: Distinguish between retryable (5xx) and permanent (4xx) errors

4. **User-Agent and Referer**: Always include proper headers for server compatibility

### General Best Practices:

1. **Fail Fast**: Don't guess parameters - discover them through testing

2. **Log Thoroughly**: Document what strategies worked/failed for debugging

3. **Cache Results**: Cache successful manifests to avoid repeated discovery

4. **Graceful Degradation**: Always provide fallback strategies

5. **Server Respect**: Implement delays and proper HTTP headers

6. **Error Messages**: Provide specific, actionable error messages for users

---

## Conclusion

The MSS Downloader codebase contains sophisticated strategies for handling diverse server types and limitations. The most successful loaders combine:

- **Multi-strategy approaches** with graceful fallback
- **Server-specific adaptations** based on known capabilities  
- **Intelligent size parameter testing** rather than guessing
- **Robust error handling** with appropriate retry logic
- **Proper HTTP etiquette** with delays and headers

For Florence manuscripts specifically, the combination of ContentDM XML parsing, multi-resolution testing, and intelligent error handling should provide reliable, high-quality downloads even with server limitations.
