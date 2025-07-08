# Grenoble Library (PaGella) Technical Analysis Report

**Generated:** 2025-07-07  
**Library:** Bibliothèque municipale de Grenoble (PaGella)  
**Domain:** `pagella.bm-grenoble.fr`  

## Executive Summary

The Grenoble municipal library uses a Gallica-based infrastructure for manuscript digitization, providing public domain access to medieval manuscripts. The system supports multiple image resolutions and provides comprehensive metadata through JSON manifests.

## URL Pattern Analysis

### Base Structure
```
https://pagella.bm-grenoble.fr/ark:/12148/{arkId}/f{pageNumber}.{resolution}
```

### Sample URLs Analyzed
1. `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom`
2. `https://pagella.bm-grenoble.fr/ark:/12148/btv1b106634178/f3.item.zoom`
3. `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663416t/f3.item.zoom`

### Key URL Components
- **Domain:** `pagella.bm-grenoble.fr`
- **ARK ID Pattern:** `ark:/12148/btv1b{identifier}`
- **Page Notation:** `f{pageNumber}` (starting from f1)
- **Resolution Options:** Multiple formats available

## IIIF Manifest Endpoints

### Primary Manifest Access
- **JSON Manifest:** `https://pagella.bm-grenoble.fr/ark:/12148/{arkId}/manifest.json`
- **Alternative:** `https://pagella.bm-grenoble.fr/ark:/12148/{arkId}.manifest`

### Manifest Structure Analysis

The manifest provides comprehensive document information including:

```json
{
  "PageAViewerFragment": {
    "totalVues": 40,
    "arkId": "btv1b10663927k",
    "typeDocument": "MANUSCRITS",
    "docType": "Manuscrits"
  }
}
```

**Key Metadata Fields:**
- `totalVues`: Total number of pages/views
- `arkId`: Unique ARK identifier
- `typeDocument`: Document type classification
- Page navigation URLs for all pages

## Image Access Patterns

### Resolution Options Discovered

1. **lowres** - Low resolution thumbnail
2. **medres** - Medium resolution (social media meta tag usage)
3. **highres** - High resolution primary image
4. **r640** - Fixed width 640 pixels
5. **r800** - Fixed width 800 pixels  
6. **r1200** - Fixed width 1200 pixels
7. **r1600** - Fixed width 1600 pixels
8. **r2400** - Fixed width 2400 pixels
9. **r3200** - Fixed width 3200 pixels
10. **native** - Original scan resolution

### Image URL Template
```
https://pagella.bm-grenoble.fr/ark:/12148/{arkId}/f{pageNumber}.{resolution}
```

**Examples:**
- `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.highres`
- `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f2.r2400`
- `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f40.medres`

## Page Counting Methodology

### Manifest-Based Discovery
1. Fetch manifest: `GET {baseUrl}/manifest.json`
2. Parse JSON response
3. Extract `totalVues` field for total page count
4. Build page URLs using pattern: `f1`, `f2`, ..., `f{totalVues}`

### Sample Implementation
```javascript
const manifestUrl = `https://pagella.bm-grenoble.fr/ark:/12148/${arkId}/manifest.json`;
const manifest = await fetch(manifestUrl).then(r => r.json());
const totalPages = manifest.PageAViewerFragment?.totalVues || 
                   manifest.contenu?.PaginationViewerModel?.nbTotalVues;
```

## Maximum Resolution Testing

### Recommended Strategy
1. Test resolutions in descending order: `native`, `r3200`, `r2400`, `r1600`, `r1200`, `highres`
2. Select largest available file size
3. Fall back to `highres` if fixed-width resolutions fail
4. Use `medres` as minimum acceptable quality

### Quality Priority Order
1. `native` (best quality, if available)
2. `r3200` (3200px width)
3. `r2400` (2400px width)  
4. `r1600` (1600px width)
5. `highres` (standard high resolution)
6. `medres` (fallback option)

## Authentication Requirements

### Access Analysis
- **Public Domain:** Documents are marked as "domaine public"
- **No Authentication:** Direct image access without login
- **CORS Policy:** May require appropriate headers
- **SSL Issues:** Certificate verification may need to be disabled

### Headers Required
```javascript
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible manuscript downloader)',
    'Accept': 'image/jpeg,image/png,image/*,*/*'
  },
  // SSL verification may need to be disabled
  rejectUnauthorized: false
};
```

## Gallica-Based Infrastructure

### System Characteristics
- **ARK Identifiers:** Uses standard ARK format (ark:/12148/...)
- **BnF Integration:** Shares infrastructure with Bibliothèque nationale de France
- **Viewer Technology:** Gallica-compatible viewer interface
- **Metadata Standards:** Dublin Core metadata in HTML meta tags
- **IIIF Compatibility:** Provides manifest endpoints

### Technical Stack
- **Image Serving:** Multi-resolution JPEG delivery
- **Metadata:** JSON-based manifest system
- **Navigation:** Page-based sequential access
- **Zoom Interface:** OpenSeadragon-based zoom viewer

## Implementation Recommendations

### Library Service Implementation

```typescript
class GrenobleLibraryService {
  private baseUrl = 'https://pagella.bm-grenoble.fr';
  
  async getManuscriptInfo(arkId: string) {
    const manifestUrl = `${this.baseUrl}/ark:/12148/${arkId}/manifest.json`;
    const manifest = await this.fetchWithSSLBypass(manifestUrl);
    return {
      totalPages: manifest.PageAViewerFragment?.totalVues,
      title: manifest.title,
      arkId: arkId
    };
  }
  
  async getPageImageUrl(arkId: string, pageNumber: number, resolution = 'highres') {
    return `${this.baseUrl}/ark:/12148/${arkId}/f${pageNumber}.${resolution}`;
  }
  
  async findBestResolution(arkId: string, pageNumber: number) {
    const resolutions = ['native', 'r3200', 'r2400', 'r1600', 'highres'];
    for (const res of resolutions) {
      const url = this.getPageImageUrl(arkId, pageNumber, res);
      if (await this.testImageUrl(url)) return res;
    }
    return 'medres'; // fallback
  }
}
```

### URL Pattern Extraction

```javascript
function extractGrenobleArkId(url) {
  const patterns = [
    /pagella\.bm-grenoble\.fr\/ark:\/12148\/(btv1b[^\/]+)/,
    /pagella\.bm-grenoble\.fr.*?ark.*?(btv1b[^\/\?&]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

## Error Handling Considerations

### Common Issues
1. **SSL Certificate Problems:** Use `rejectUnauthorized: false`
2. **Connection Timeouts:** Implement proper timeout handling
3. **Rate Limiting:** Add delays between requests
4. **Resolution Availability:** Test multiple resolutions with fallbacks

### Retry Strategy
```javascript
async function downloadWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchWithSSLBypass(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Quality Assurance

### Validation Requirements
1. **Image Format:** Verify JPEG headers (0xFFD8FF)
2. **File Size:** Ensure reasonable file sizes (>50KB for manuscripts)
3. **Content Verification:** Check for actual manuscript content vs error pages
4. **Page Sequence:** Validate all pages from 1 to totalVues
5. **Resolution Testing:** Confirm optimal resolution selection

### Testing Protocol
1. Extract ARK ID from sample URLs
2. Fetch manifest and verify page count
3. Test multiple resolution options
4. Download sample pages for content verification
5. Measure file sizes and quality
6. Validate PDF generation pipeline

## Integration Priority

**Complexity:** Medium  
**Implementation Time:** 2-3 hours  
**Success Probability:** High  

### Key Advantages
- Public domain access (no authentication)
- Multiple resolution options
- Comprehensive metadata via manifests
- Gallica-compatible infrastructure
- Clear URL patterns

### Potential Challenges
- SSL certificate verification issues
- Connection stability concerns
- Resolution availability variations
- Rate limiting considerations

## Conclusion

The Grenoble library system provides excellent manuscript access through a well-structured Gallica-based platform. Implementation should be straightforward with proper SSL handling and resolution testing. The multiple resolution options and comprehensive manifests make this an excellent candidate for manuscript downloader integration.

**Recommended Next Steps:**
1. Implement basic ARK ID extraction
2. Add manifest parsing for page counts
3. Implement multi-resolution testing
4. Add proper SSL certificate handling
5. Create comprehensive validation suite