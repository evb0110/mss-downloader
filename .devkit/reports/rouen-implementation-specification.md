# Rouen Library (rotomagus.fr) Implementation Specification

## Library Overview
- **Name**: Bibliothèque municipale de Rouen (Rouen Municipal Library)
- **Domain**: rotomagus.fr  
- **Type**: French municipal library with digitized manuscripts and historical documents
- **Access**: Public domain manuscripts, no authentication required
- **Implementation Complexity**: **Low** - Direct URL construction with session management

## URL Patterns

### Viewer URLs
```
https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.item.zoom
```

### Image URLs
```
https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.{resolution}
```

### Manifest URLs (for page discovery)
```
https://www.rotomagus.fr/ark:/12148/{manuscriptId}/manifest.json
```

## Manuscript ID Format
- ARK identifiers following pattern: `btv1b{alphanumeric}`
- Examples:
  - `btv1b10052442z` (93 pages)
  - `btv1b10052441h` (13 pages)  
  - `btv1b100508259` (395 pages)

## Image Resolutions

| Resolution | Quality | Typical Size | Use Case |
|------------|---------|--------------|----------|
| `highres` | High | 300-600KB | **Recommended** - Best quality |
| `medres` | Medium | 80-130KB | Good balance |
| `lowres` | Low | 20-30KB | Preview only |

**Recommendation**: Use `highres` for maximum quality downloads.

## Page Discovery Method

### Primary Method: Manifest JSON
1. Access: `https://www.rotomagus.fr/ark:/12148/{manuscriptId}/manifest.json`
2. Parse JSON for `"totalNumberPage": {number}`
3. **100% Success Rate** across tested manuscripts

### Fallback Method: Viewer Page Parsing
1. Access viewer page
2. Search for patterns: `"totalVues"`, `"nbTotalVues"`, or `"totalNumberPage"`
3. Extract page count from JSON data

## Page Numbering
- **Format**: `f{number}` (e.g., f1, f2, f46, f93)
- **Start Page**: 1
- **Sequential**: Yes, no gaps
- **Leading Zeros**: Not required

## Authentication & Headers

### Required Headers
```javascript
{
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Referer': 'https://www.rotomagus.fr/ark:/12148/{manuscriptId}/f{pageNumber}.item.zoom'
}
```

### Session Management
- **Cookies Required**: Yes (JSESSIONID)
- **Session Establishment**: Access viewer page first
- **Session Duration**: Persistent across requests
- **No Authentication**: Public access

## Implementation Algorithm

### Step 1: Page Discovery
```javascript
async function getPageCount(manuscriptId) {
  const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
  const response = await fetch(manifestUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
  
  const manifest = await response.json();
  return manifest.totalNumberPage;
}
```

### Step 2: Session Establishment
```javascript
async function establishSession(manuscriptId) {
  const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
  await fetch(viewerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });
}
```

### Step 3: Image Download
```javascript
async function downloadPage(manuscriptId, pageNumber, resolution = 'highres') {
  const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.${resolution}`;
  const refererUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${pageNumber}.item.zoom`;
  
  return fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': refererUrl
    }
  });
}
```

## Validation Results

### Test Results Summary
- **Manuscripts Tested**: 5
- **Success Rate**: 100% (5/5)
- **Page Access Rate**: 100% across all test pages
- **Resolution Support**: All 3 resolutions working
- **Page Discovery**: 100% successful via manifest.json

### Test Cases
1. **btv1b10052442z**: Biblia sacra [Illustrations de] - 93 pages ✅
2. **btv1b10052441h**: Medieval manuscript - 13 pages ✅  
3. **btv1b100508259**: Benedictionarium anglo-saxonicum - 395 pages ✅
4. **btv1b101040278**: Psalterium Hibernicum - 313 pages ✅
5. **btv1b10050014d**: Sacramentarium - 91 pages ✅

## Implementation Complexity Assessment

### Complexity: LOW
- ✅ Direct URL construction
- ✅ Predictable page numbering
- ✅ Reliable page discovery
- ✅ Standard HTTP headers
- ✅ No complex authentication
- ✅ Consistent image formats

### Potential Issues
- ⚠️ Requires session cookie management
- ⚠️ Must include proper Referer header
- ⚠️ Server may block requests without User-Agent

## Integration Priority
**Recommended**: HIGH - Simple implementation with excellent reliability and comprehensive manuscript collections.

## Test URLs for Validation
```
https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom
https://www.rotomagus.fr/ark:/12148/btv1b10052441h/f1.item.zoom
https://www.rotomagus.fr/ark:/12148/btv1b100508259/f3.item.zoom
```

## Content Quality
- **Image Quality**: High resolution JPEG images
- **Content Type**: Medieval manuscripts, religious texts, historical documents
- **Languages**: Primarily Latin, French
- **Digitization Quality**: Professional scanning with good color reproduction
- **Manuscript Age**: 9th-15th century manuscripts