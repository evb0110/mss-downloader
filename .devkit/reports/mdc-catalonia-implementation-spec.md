# MDC Catalonia Implementation Specification

## URL Detection and Parsing

### Pattern Recognition
```javascript
const MDC_CATALONIA_PATTERNS = [
  /mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/,
  /mdc\.csuc\.cat\/iiif\/2\/([^:]+):(\d+)/
];
```

### URL Structure Components
- **Domain**: `mdc.csuc.cat`
- **Collection**: Alphanumeric identifier (e.g., `incunableBC`)
- **Item ID**: Numeric identifier (e.g., `175331`)
- **Page Number**: Optional record number (e.g., `rec/1`)

## IIIF API Integration

### Core Endpoints
1. **Image Info**: `https://mdc.csuc.cat/iiif/2/{collection}:{itemId}/info.json`
2. **Image Data**: `https://mdc.csuc.cat/iiif/2/{collection}:{itemId}/{region}/{size}/{rotation}/{quality}.{format}`
3. **Metadata**: `https://mdc.csuc.cat/api/singleitem/collection/{collection}/id/{itemId}/thumbnail`

### Maximum Resolution Strategy
```javascript
async function getMaxResolution(collection, itemId) {
  const infoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
  const response = await fetch(infoUrl);
  const info = await response.json();
  
  // Test various size parameters for maximum quality
  const sizeTests = [
    'full', 'max', '9999,', ',9999', 'full/full'
  ];
  
  let maxDimensions = { width: info.width, height: info.height };
  
  for (const size of sizeTests) {
    const testUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/${size}/0/default.jpg`;
    // Test HEAD request to verify availability
    const headResponse = await fetch(testUrl, { method: 'HEAD' });
    if (headResponse.ok) {
      // Parse actual dimensions from response headers if available
      maxDimensions = await verifyImageDimensions(testUrl);
      break;
    }
  }
  
  return maxDimensions;
}
```

## Page Discovery Algorithm

### Compound Object Structure
```javascript
async function discoverPages(collection, itemId) {
  const baseUrl = `https://mdc.csuc.cat/digital/collection/${collection}/id/${itemId}`;
  
  // Method 1: Parse from initial page HTML
  const pageResponse = await fetch(baseUrl);
  const pageHtml = await pageResponse.text();
  
  // Extract compound object data
  const compoundMatch = pageHtml.match(/"nodes":\s*(\[.*?\])/s);
  if (compoundMatch) {
    const nodes = JSON.parse(compoundMatch[1]);
    return nodes.map(node => ({
      id: node.id,
      title: node.title,
      pageUrl: `${baseUrl}/rec/${node.id}`,
      imageUrl: `https://mdc.csuc.cat/iiif/2/${collection}:${node.id}/full/full/0/default.jpg`
    }));
  }
  
  // Method 2: Sequential page enumeration fallback
  const pages = [];
  let pageNum = 1;
  let consecutiveFailures = 0;
  
  while (consecutiveFailures < 3) {
    const pageUrl = `${baseUrl}/rec/${pageNum}`;
    const response = await fetch(pageUrl);
    
    if (response.ok) {
      pages.push({
        id: pageNum,
        title: `Page ${pageNum}`,
        pageUrl: pageUrl,
        imageUrl: `https://mdc.csuc.cat/iiif/2/${collection}:${pageNum}/full/full/0/default.jpg`
      });
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }
    pageNum++;
  }
  
  return pages;
}
```

## Image Quality Optimization

### Resolution Testing Matrix
```javascript
const RESOLUTION_TESTS = [
  { size: 'full', quality: 'default', format: 'jpg' },
  { size: 'max', quality: 'default', format: 'jpg' },
  { size: '9999,', quality: 'default', format: 'jpg' },
  { size: ',9999', quality: 'default', format: 'jpg' },
  { size: 'full', quality: 'color', format: 'tif' },
  { size: 'full', quality: 'default', format: 'png' }
];

async function optimizeImageQuality(collection, itemId) {
  const infoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
  const info = await fetch(infoUrl).then(r => r.json());
  
  let bestOption = {
    url: `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/full/0/default.jpg`,
    size: info.width * info.height,
    quality: 'default'
  };
  
  for (const test of RESOLUTION_TESTS) {
    const testUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/full/${test.size}/0/${test.quality}.${test.format}`;
    
    try {
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        if (contentLength > bestOption.size) {
          bestOption = {
            url: testUrl,
            size: contentLength,
            quality: test.quality
          };
        }
      }
    } catch (error) {
      // Skip failed tests
    }
  }
  
  return bestOption;
}
```

## Metadata Extraction

### Multilingual Support
```javascript
async function extractMetadata(collection, itemId) {
  const metadataUrl = `https://mdc.csuc.cat/api/singleitem/collection/${collection}/id/${itemId}/thumbnail`;
  const response = await fetch(metadataUrl);
  const data = await response.json();
  
  return {
    title: data.title || 'Unknown Title',
    creator: data.creator || 'Unknown Creator',
    date: data.date || 'Unknown Date',
    language: data.language || 'Unknown Language',
    rights: data.rights || 'Unknown Rights',
    description: data.description || '',
    subject: data.subject || '',
    collection: collection,
    itemId: itemId,
    pageCount: data.pageCount || 0,
    totalPages: data.totalPages || 0
  };
}
```

## Error Handling Strategy

### Robust Error Recovery
```javascript
class MDCCataloniaDownloader {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
  }
  
  async downloadWithRetry(url, attempt = 1) {
    try {
      const response = await fetch(url, { 
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'image/jpeg,image/png,image/tiff,*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.arrayBuffer();
    } catch (error) {
      if (attempt < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.downloadWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }
}
```

## Integration Points

### Service Integration
```javascript
// In EnhancedManuscriptDownloaderService.ts
export class MDCCataloniaLibrary implements LibraryInterface {
  name = 'MDC Catalonia';
  domains = ['mdc.csuc.cat'];
  
  async canHandle(url: string): Promise<boolean> {
    return MDC_CATALONIA_PATTERNS.some(pattern => pattern.test(url));
  }
  
  async extractPages(url: string): Promise<PageInfo[]> {
    const match = this.parseUrl(url);
    if (!match) throw new Error('Invalid MDC Catalonia URL');
    
    const { collection, itemId } = match;
    const pages = await this.discoverPages(collection, itemId);
    
    return pages.map(page => ({
      url: page.imageUrl,
      title: page.title,
      pageNumber: page.id,
      metadata: {
        collection,
        itemId: page.id,
        originalUrl: page.pageUrl
      }
    }));
  }
}
```

## Testing Protocol

### Validation Test Suite
```javascript
describe('MDC Catalonia Implementation', () => {
  const testUrls = [
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/49455/rec/2',
    'https://mdc.csuc.cat/digital/collection/incunableBC/id/14914/rec/1'
  ];
  
  test('should detect MDC Catalonia URLs', () => {
    testUrls.forEach(url => {
      expect(MDCCataloniaLibrary.canHandle(url)).toBe(true);
    });
  });
  
  test('should extract page information', async () => {
    const library = new MDCCataloniaLibrary();
    const pages = await library.extractPages(testUrls[0]);
    
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]).toHaveProperty('url');
    expect(pages[0]).toHaveProperty('title');
    expect(pages[0]).toHaveProperty('pageNumber');
  });
  
  test('should download maximum resolution images', async () => {
    const library = new MDCCataloniaLibrary();
    const pages = await library.extractPages(testUrls[0]);
    
    const imageData = await library.downloadWithRetry(pages[0].url);
    expect(imageData.byteLength).toBeGreaterThan(100000); // At least 100KB
  });
});
```

## Performance Considerations

### Optimization Strategies
1. **Parallel Processing**: Download multiple pages concurrently
2. **Connection Pooling**: Reuse HTTP connections for efficiency
3. **Response Caching**: Cache IIIF info.json responses
4. **Progressive Loading**: Start with thumbnails, upgrade to full resolution
5. **Bandwidth Management**: Implement rate limiting and retry logic

### Memory Management
```javascript
const CONCURRENT_DOWNLOADS = 3;
const semaphore = new Semaphore(CONCURRENT_DOWNLOADS);

async function downloadPages(pages) {
  const downloadPromises = pages.map(async (page) => {
    await semaphore.acquire();
    try {
      return await downloadPage(page);
    } finally {
      semaphore.release();
    }
  });
  
  return Promise.all(downloadPromises);
}
```

This implementation specification provides a comprehensive technical foundation for integrating MDC Catalonia support into the manuscript downloader application.