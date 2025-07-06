# MDC Catalonia Implementation Guide

## Quick Start Implementation

### 1. URL Pattern Detection
```typescript
// Add to LibraryOptimizationService.ts
private isMDCCatalonia(url: string): boolean {
  return /https?:\/\/mdc\.csuc\.cat\/digital\/collection\//.test(url);
}

private extractMDCCataloniaIds(url: string): { collectionId: string; documentId: string } | null {
  const match = url.match(/https?:\/\/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)/);
  if (!match) return null;
  return {
    collectionId: match[1],
    documentId: match[2]
  };
}
```

### 2. API Integration
```typescript
// Add to EnhancedManuscriptDownloaderService.ts
private async fetchMDCCataloniaPages(collectionId: string, documentId: string): Promise<PageInfo[]> {
  const apiUrl = `https://mdc.csuc.cat/digital/api/singleitem/collection/${collectionId}/id/${documentId}`;
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.objectInfo || !data.objectInfo.page) {
      throw new Error('Invalid API response structure');
    }
    
    return data.objectInfo.page.map((page: any, index: number) => ({
      index: index + 1,
      title: page.pagetitle,
      imageUrl: `https://mdc.csuc.cat/iiif/2/${collectionId}:${page.pageptr}/full/full/0/default.jpg`,
      infoUrl: `https://mdc.csuc.cat/iiif/2/${collectionId}:${page.pageptr}/info.json`
    }));
  } catch (error) {
    console.error('Failed to fetch MDC Catalonia pages:', error);
    throw error;
  }
}
```

### 3. Integration with Main Service
```typescript
// Add to processManuscriptUrl method
if (this.isMDCCatalonia(url)) {
  const ids = this.extractMDCCataloniaIds(url);
  if (!ids) {
    throw new Error('Invalid MDC Catalonia URL format');
  }
  
  const pages = await this.fetchMDCCataloniaPages(ids.collectionId, ids.documentId);
  
  // Process pages with existing pipeline
  for (const page of pages) {
    await this.downloadImage(page.imageUrl, page.title);
  }
  
  return;
}
```

## Advanced Features

### 1. Quality Selection
```typescript
private buildMDCCataloniaImageUrl(
  collectionId: string, 
  pagePtr: string, 
  quality: 'default' | 'color' | 'gray' | 'bitonal' = 'default',
  format: 'jpg' | 'png' | 'tif' | 'gif' = 'jpg'
): string {
  return `https://mdc.csuc.cat/iiif/2/${collectionId}:${pagePtr}/full/full/0/${quality}.${format}`;
}
```

### 2. Metadata Extraction
```typescript
private extractMDCCataloniaMetadata(data: any): ManuscriptMetadata {
  const fields = data.fields || [];
  const metadata: ManuscriptMetadata = {};
  
  fields.forEach((field: any) => {
    switch (field.key) {
      case 'title':
        metadata.title = field.value;
        break;
      case 'date':
        metadata.date = field.value;
        break;
      case 'langua':
        metadata.language = field.value;
        break;
      case 'subjec':
        metadata.subject = field.value;
        break;
      case 'publis':
        metadata.publisher = field.value;
        break;
    }
  });
  
  return metadata;
}
```

### 3. Error Handling
```typescript
private async downloadMDCCataloniaImage(imageUrl: string, title: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    
    if (response.status === 403) {
      console.warn(`Scale limit exceeded for ${title}, using maximum available`);
      // Retry with full/max instead of full/full
      const maxUrl = imageUrl.replace('/full/full/', '/full/max/');
      return this.downloadMDCCataloniaImage(maxUrl, title);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Process image download
    const imageData = await response.arrayBuffer();
    await this.saveImage(imageData, title);
    
  } catch (error) {
    console.error(`Failed to download MDC Catalonia image ${title}:`, error);
    throw error;
  }
}
```

## Testing Strategy

### 1. Unit Tests
```typescript
// Test URL pattern detection
describe('MDC Catalonia URL Detection', () => {
  it('should detect valid MDC Catalonia URLs', () => {
    const url = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    expect(service.isMDCCatalonia(url)).toBe(true);
  });
  
  it('should extract collection and document IDs', () => {
    const url = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    const ids = service.extractMDCCataloniaIds(url);
    expect(ids).toEqual({
      collectionId: 'incunableBC',
      documentId: '175331'
    });
  });
});
```

### 2. Integration Tests
```typescript
// Test API integration
describe('MDC Catalonia API Integration', () => {
  it('should fetch pages from API', async () => {
    const pages = await service.fetchMDCCataloniaPages('incunableBC', '175331');
    expect(pages).toHaveLength(385);
    expect(pages[0]).toHaveProperty('title');
    expect(pages[0]).toHaveProperty('imageUrl');
  });
});
```

### 3. Validation Tests
```typescript
// Test image download
describe('MDC Catalonia Image Download', () => {
  it('should download images successfully', async () => {
    const imageUrl = 'https://mdc.csuc.cat/iiif/2/incunableBC:174519/full/full/0/default.jpg';
    const imageData = await service.downloadImage(imageUrl);
    expect(imageData).toBeInstanceOf(ArrayBuffer);
    expect(imageData.byteLength).toBeGreaterThan(0);
  });
});
```

## Configuration

### 1. Library Configuration
```typescript
// Add to types.ts
export interface MDCCataloniaConfig {
  quality: 'default' | 'color' | 'gray' | 'bitonal';
  format: 'jpg' | 'png' | 'tif' | 'gif';
  includeCovers: boolean;
  includeBlankPages: boolean;
  maxConcurrentDownloads: number;
}

// Add to queueTypes.ts
export interface MDCCataloniaJob extends BaseJobData {
  type: 'mdc-catalonia';
  collectionId: string;
  documentId: string;
  config: MDCCataloniaConfig;
}
```

### 2. Default Settings
```typescript
const DEFAULT_MDC_CATALONIA_CONFIG: MDCCataloniaConfig = {
  quality: 'default',
  format: 'jpg',
  includeCovers: true,
  includeBlankPages: false,
  maxConcurrentDownloads: 5
};
```

## Performance Optimization

### 1. Concurrent Downloads
```typescript
private async downloadMDCCataloniaManuscript(
  collectionId: string, 
  documentId: string,
  config: MDCCataloniaConfig
): Promise<void> {
  const pages = await this.fetchMDCCataloniaPages(collectionId, documentId);
  
  // Filter pages based on config
  const filteredPages = pages.filter(page => {
    if (!config.includeCovers && /coberta|cover/i.test(page.title)) return false;
    if (!config.includeBlankPages && /blank|blanc/i.test(page.title)) return false;
    return true;
  });
  
  // Download in batches
  const batchSize = config.maxConcurrentDownloads;
  for (let i = 0; i < filteredPages.length; i += batchSize) {
    const batch = filteredPages.slice(i, i + batchSize);
    await Promise.all(batch.map(page => 
      this.downloadImage(page.imageUrl, page.title)
    ));
  }
}
```

### 2. Progress Tracking
```typescript
private async downloadWithProgress(
  pages: PageInfo[],
  progressCallback: (progress: ProgressUpdate) => void
): Promise<void> {
  let completed = 0;
  
  for (const page of pages) {
    try {
      await this.downloadImage(page.imageUrl, page.title);
      completed++;
      
      progressCallback({
        current: completed,
        total: pages.length,
        percentage: Math.round((completed / pages.length) * 100),
        currentPage: page.title
      });
    } catch (error) {
      console.error(`Failed to download page ${page.title}:`, error);
    }
  }
}
```

## Deployment Checklist

- [ ] Add URL pattern detection to `LibraryOptimizationService.ts`
- [ ] Implement API integration in `EnhancedManuscriptDownloaderService.ts`
- [ ] Add error handling and retry logic
- [ ] Implement progress tracking
- [ ] Add configuration options
- [ ] Create unit tests
- [ ] Create integration tests
- [ ] Perform validation testing
- [ ] Update documentation
- [ ] Deploy and monitor

## Expected Performance

- **API Response Time**: 200-500ms
- **Image Download Speed**: 2-5MB/s per connection
- **Concurrent Downloads**: 5 recommended
- **Memory Usage**: ~50MB per batch
- **Success Rate**: >99% (based on analysis)

---

*Implementation guide for MDC Catalonia integration*
*Estimated development time: 2-3 hours*
*Difficulty: Low - Standard IIIF implementation*