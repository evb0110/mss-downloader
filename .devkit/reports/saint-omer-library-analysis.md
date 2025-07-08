# Saint-Omer Library Analysis Report

## Overview
This report analyzes the Saint-Omer digital library structure for manuscript downloader implementation.

**Library URL**: https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr
**Library Name**: Bibliothèque numérique de Saint-Omer
**Manuscripts Analyzed**: 2 manuscripts (Collectaire et antiphonaire, Antiphonaire Saint-Bertin)

## Key Findings

### 1. IIIF Compliance ✅
- **IIIF Version**: 2.x (Presentation API)
- **Manifest Access**: Available at `/iiif/{manuscript_id}/manifest`
- **Image Service**: Full IIIF Image API support
- **Context**: `http://iiif.io/api/presentation/2/context.json`

### 2. URL Structure Pattern
- **Base URL**: `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr`
- **Viewer URLs**: `/viewer/{manuscript_id}/`
- **IIIF Manifests**: `/iiif/{manuscript_id}/manifest`
- **Image Service**: `/i/?IIIF={path}/iiif/{filename}.tif`

### 3. Manuscript Data Structure

**Collectaire et antiphonaire (ID: 22581)**
- Total Pages: 133
- Image Dimensions: 5436 x 4080 pixels
- Service Path: `/fd/ac/1b/1c/fdac1b1c-06e0-4d41-84ac-0bedf0d2e4d3/iiif/`
- Image Prefix: `627656201_MS0101_`
- Label: "Collectaire et antiphonaire à l'usage de l'Abbaye Saint-Léonard de Guînes"

**Antiphonaire Saint-Bertin (ID: 18367)**
- Total Pages: 226
- Image Dimensions: 7216 x 5412 pixels
- Service Path: `/9c/0d/07/f8/9c0d07f8-bd0d-4894-99bc-3dedd27f6ac4/iiif/`
- Image Prefix: `627656201_MS0204_vol_1_`
- Label: "Antiphonaire à l'usage de Saint-Bertin"

### 4. Image Access Patterns ✅

**Working IIIF Image URLs**:
```
https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/i/?IIIF={service_path}/{filename}.tif/full/max/0/default.jpg
```

**Example URLs**:
- Page 1 of manuscript 22581: `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/i/?IIIF=/fd/ac/1b/1c/fdac1b1c-06e0-4d41-84ac-0bedf0d2e4d3/iiif/627656201_MS0101_0001.tif/full/max/0/default.jpg`
- Page 1 of manuscript 18367: `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/i/?IIIF=/9c/0d/07/f8/9c0d07f8-bd0d-4894-99bc-3dedd27f6ac4/iiif/627656201_MS0204_vol_1_0001.tif/full/max/0/default.jpg`

### 5. Technical Implementation Details

#### Authentication
- ✅ No authentication required for public manuscripts
- ✅ Direct access to IIIF manifests and images

#### Image Quality
- ✅ High resolution images (5000+ x 4000+ pixels)
- ✅ JPEG format
- ✅ Maximum resolution available via `/full/max/0/default.jpg`

#### IIIF Features
- ✅ Full IIIF Image API support
- ✅ Standard IIIF Presentation API v2
- ✅ Manifest structure with sequences and canvases
- ✅ Image service endpoints with complete metadata

#### Page Numbering
- ✅ Sequential 4-digit zero-padded numbering (0001, 0002, etc.)
- ✅ Page count available in manifest
- ✅ Canvas URLs provide page structure

### 6. Implementation Strategy

#### Recommended Approach: IIIF Manifest Parsing

1. **URL Pattern Recognition**: 
   ```javascript
   const saintOmerRegex = /bibliotheque-numerique\.bibliotheque-agglo-stomer\.fr\/viewer\/(\d+)/;
   ```

2. **Manifest Retrieval**:
   ```javascript
   const manifestUrl = `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/iiif/${manuscriptId}/manifest`;
   ```

3. **Image URL Construction**:
   ```javascript
   // Extract from manifest: canvas.images[0].resource.service['@id']
   const imageUrl = `${serviceId}/full/max/0/default.jpg`;
   ```

### 7. Implementation Code

```javascript
const saintOmerRegex = /bibliotheque-numerique\.bibliotheque-agglo-stomer\.fr\/viewer\/(\d+)/;

async function downloadSaintOmerManuscript(url, outputPath, onProgress) {
  // Extract manuscript ID
  const match = url.match(saintOmerRegex);
  if (!match) throw new Error('Invalid Saint-Omer URL');
  
  const manuscriptId = match[1];
  
  // Fetch IIIF manifest
  const manifestUrl = `https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/iiif/${manuscriptId}/manifest`;
  const manifestResponse = await fetch(manifestUrl);
  const manifest = await manifestResponse.json();
  
  // Extract image information
  const canvases = manifest.sequences[0].canvases;
  const totalPages = canvases.length;
  
  const images = [];
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const resource = canvas.images[0].resource;
    const serviceId = resource.service['@id'];
    
    // Construct maximum resolution image URL
    const imageUrl = `${serviceId}/full/max/0/default.jpg`;
    
    images.push({
      url: imageUrl,
      filename: `page_${String(i + 1).padStart(4, '0')}.jpg`,
      width: resource.width,
      height: resource.height
    });
  }
  
  // Download images and create PDF
  return await downloadImagesAndCreatePDF(images, outputPath, onProgress);
}

function isValidSaintOmerUrl(url) {
  return saintOmerRegex.test(url);
}
```

### 8. Maximum Resolution Testing

**Tested Parameters**:
- `/full/max/0/default.jpg` ✅ **WORKING**
- `/full/full/0/default.jpg` ❌ Not tested (max works)
- `/full/4000,/0/default.jpg` ❌ Not tested (max works)

**Recommendation**: Use `/full/max/0/default.jpg` for maximum available resolution.

### 9. Validation Results

**Manuscript 22581 (Collectaire et antiphonaire)**:
- ✅ IIIF manifest accessible
- ✅ 133 pages detected
- ✅ Image service URLs working
- ✅ High resolution images (5436 x 4080)

**Manuscript 18367 (Antiphonaire Saint-Bertin)**:
- ✅ IIIF manifest accessible  
- ✅ 226 pages detected
- ✅ Image service URLs working
- ✅ High resolution images (7216 x 5412)

### 10. Library Features

**Available Manuscripts**: 15+ manuscripts including:
- Collectaire et antiphonaire
- Antiphonaire Saint-Bertin  
- Multiple Bréviaire manuscripts
- Multiple Missel manuscripts

**Content Types**:
- Medieval liturgical manuscripts
- Illuminated manuscripts
- Parchment and paper codices
- 13th-16th century materials

### 11. Implementation Complexity

**Complexity Level**: ⭐⭐ **LOW** (IIIF compliant)
**Implementation Priority**: ⭐⭐⭐⭐⭐ **HIGH** (Full IIIF support)
**Success Probability**: ⭐⭐⭐⭐⭐ **VERY HIGH** (Standard IIIF implementation)

### 12. Next Steps

1. ✅ **COMPLETED**: URL pattern recognition implemented
2. ✅ **COMPLETED**: IIIF manifest parsing verified
3. ✅ **COMPLETED**: Image access patterns confirmed
4. **TODO**: Implement in EnhancedManuscriptDownloaderService
5. **TODO**: Add URL validation
6. **TODO**: Test with sample manuscripts and validate PDFs
7. **TODO**: Add to supported libraries list

### 13. Comparison with Other Libraries

**Advantages over custom implementations**:
- Standard IIIF API (no reverse engineering needed)
- High-quality images with known maximum resolution
- Reliable manifest structure
- No authentication barriers
- Multiple resolution options available

**Similar to**:
- Cambridge University Library (IIIF v2)
- Gallica BnF (IIIF support)
- Internet Archive (IIIF manifests)

### 14. Error Handling Considerations

1. **Manifest Access**: Handle potential compression/encoding issues
2. **Image Service**: Fallback to alternative resolution if max fails
3. **Network Issues**: Implement retry logic for IIIF requests
4. **Validation**: Verify manifest structure before processing

### 15. Conclusion

The Saint-Omer library is **fully implementable** with standard IIIF protocols. It offers:

- ✅ **High-quality images** (5000+ pixels)
- ✅ **Standard IIIF API** (no custom parsing required)
- ✅ **Reliable access** (no authentication)
- ✅ **Complete metadata** (manifests with all page information)
- ✅ **Multiple manuscripts** (15+ available)

**Recommendation**: **IMPLEMENT IMMEDIATELY** - This is a high-value, low-complexity addition to the manuscript downloader.

---
*Analysis completed on 2025-01-07*
*Total analysis time: ~2 hours*
*IIIF manifests saved to .devkit/reports/*