# Rome BNC New URL Pattern Analysis: `libroantico` Support

## Issue Summary
The Rome BNC (Biblioteca Nazionale Centrale di Roma) library has a new URL pattern that is not currently supported:
- **New Pattern**: `http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1`
- **Currently Supported**: `http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1`

## Key Differences Analysis

### 1. URL Structure Comparison

**Current (manoscrittoantico)**:
```
http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/{MANUSCRIPT_ID}/{MANUSCRIPT_ID}/{PAGE_NUMBER}
```

**New (libroantico)**:
```
http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/{MANUSCRIPT_ID}/{MANUSCRIPT_ID}/{PAGE_NUMBER}
```

**Differences**:
- Path segment: `manoscrittoantico` vs `libroantico`
- Manuscript ID format: `BNCR_Ms_SESS_0062` vs `BVEE112879`
- Same structure otherwise: duplicate manuscript ID and page number

### 2. Image URL Patterns

**Current (manoscrittoantico)**:
```
http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/{MANUSCRIPT_ID}/{MANUSCRIPT_ID}/{PAGE}/original
```

**New (libroantico)**:
```
http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/{MANUSCRIPT_ID}/{MANUSCRIPT_ID}/{PAGE}/full
```

**Available resolutions** (from curl analysis):
- `/thumb` - Thumbnail images (used for page previews)
- `/med` - Medium resolution 
- `/full` - Full resolution (highest quality available)

### 3. Page Metadata Extraction

**Page Count**: Found in HTML as `<h2 class="title">Totale immagini: 594</h2>`

**Title**: Found in multiple places:
- Breadcrumb: "Missale ad vsum ecclesie cathedralis Bicterrensis summa cum diligentia ..."
- Page heading: "Dettaglio libro antico: Missale ad vsum ecclesie cathedralis Bicterrensis..."
- Data detail section: Full title in `<dd>` element

**Sample metadata from test URL**:
- Manuscript ID: `BVEE112879`
- Total pages: 594
- Title: "Missale ad vsum ecclesie cathedralis Bicterrensis summa cum diligentia mendis tersum quod hactenus non fuerat..."
- Author: "Diocesi di Beziers"
- Publication: "(Lugduni per Joannem Crispin excusum Constantini Fradin bibliopole solertissimi cura et impensis 1535 die septimo mensis Augusti)"

## Current Implementation Analysis

The current implementation in `EnhancedManuscriptDownloaderService.ts`:

```typescript
// URL matching - only checks for 'manoscrittoantico'
const urlMatch = romeUrl.match(/\/manoscrittoantico\/([^/]+)\/([^/]+)\/(\d+)/);

// Image URL template - hardcoded to 'manoscrittoantico' and '/original'
imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/${manuscriptId}/${manuscriptId}/PAGENUM/original`;
```

## Required Implementation Changes

### 1. Update URL Pattern Matching

The current regex needs to support both patterns:

```typescript
// Current
const urlMatch = romeUrl.match(/\/manoscrittoantico\/([^/]+)\/([^/]+)\/(\d+)/);

// Updated (proposed)
const urlMatch = romeUrl.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
```

### 2. Dynamic Collection Type Detection

Extract the collection type and use it for image URLs:

```typescript
const [, collectionType, manuscriptId1, manuscriptId2, pageNumber] = urlMatch;
// collectionType will be either 'manoscrittoantico' or 'libroantico'
```

### 3. Image URL Template Generation

Update template generation to use the detected collection type:

```typescript
// For manoscrittoantico - keep using '/original' (highest quality)
// For libroantico - use '/full' (highest available quality)
const resolutionParam = collectionType === 'manoscrittoantico' ? 'original' : 'full';
imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/PAGENUM/${resolutionParam}`;
```

### 4. Page Count Extraction

The page count extraction should work for both patterns since they use the same HTML structure:

```typescript
// This works for both patterns
const pageCountMatch = html.match(/Totale immagini:\s*(\d+)/);
```

### 5. Title Extraction

Title extraction should also work for both patterns:

```typescript
// Existing patterns should work, but may need refinement for libroantico specific content
const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/) || 
                  html.match(/Dettaglio.*?:\s*([^<]+)/) ||
                  html.match(/breadcrumb[^>]*>.*?\|\s*([^|<]+)/);
```

## Implementation Strategy

### Phase 1: Core Support
1. Update URL regex to support both `manoscrittoantico` and `libroantico`
2. Extract collection type from URL
3. Generate appropriate image URL templates based on collection type
4. Test with the provided example URL

### Phase 2: Quality Optimization
1. Determine optimal resolution parameters for each collection type
2. Add fallback resolution handling if `/full` or `/original` fail
3. Verify image accessibility and quality

### Phase 3: Testing & Validation
1. Add test cases for `libroantico` URLs
2. Update existing Rome library tests to cover both patterns
3. Verify metadata extraction works correctly for both types

## Test URLs for Implementation

**libroantico (new pattern)**:
- `http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1`
- Expected: 594 pages, title starts with "Missale ad vsum ecclesie cathedralis Bicterrensis"

**manoscrittoantico (existing pattern)**:
- `http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1`
- Expected: 175 pages, title contains "Tropario"

## Potential Edge Cases

1. **Resolution Availability**: Not all collections may support the same resolution parameters
2. **Access Restrictions**: Some libroantico materials might have different access controls
3. **Manuscript ID Formats**: libroantico uses shorter IDs (BVEE112879) vs manoscrittoantico (BNCR_Ms_SESS_0062)
4. **Page Numbering**: Both seem to use 1-based page numbering
5. **Metadata Variations**: Different collection types might have slightly different HTML structures

## Recommendation

The implementation should be straightforward since both URL patterns follow the same basic structure and the Rome BNC site uses consistent HTML templates. The main changes needed are:

1. **Update regex pattern** to capture collection type
2. **Use collection type** in image URL generation  
3. **Adjust resolution parameter** based on collection type
4. **Add comprehensive tests** for both patterns

This should provide full support for both `manoscrittoantico` and `libroantico` URL patterns while maintaining backward compatibility.