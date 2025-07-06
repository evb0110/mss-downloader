# E-Manuscripta Basel Multi-Block Manuscript Analysis

## Executive Summary

E-Manuscripta uses a sophisticated multi-block system where large manuscripts are organized into logical sections with separate IIIF canvases and URL endpoints. The current implementation has **COMPLETE multi-block support** but uses a **fundamentally flawed discovery approach** that leads to incomplete downloads.

## Key Findings

### 1. IIIF Manifest Structure Analysis
Based on manifest `https://www.e-manuscripta.ch/i3f/v20/5157222/manifest`:

- **Total Canvases**: 404 pages 
- **Structured Ranges**: 24 logical sections including:
  - Prima Pars [3r-70r] - 135 canvases
  - Secunda Pars [70v-123v] - 107 canvases  
  - Tertia Pars [124r-141v] - 36 canvases
  - Nova statuta [142r-169r] - 56 canvases
  - Consuetudines [170r-192v] - 50 canvases

- **Canvas ID Range**: 5157223 to 5157626 (sequential numbering)
- **No Block Gaps**: All IDs are sequential in the IIIF manifest

### 2. URL Structure Analysis
The analyzed URLs represent **different views of the SAME manuscript**, not separate manuscripts:

- `5157222` - Main manuscript titleinfo (entry point)
- `5157228`, `5157615`, `5157616` - **Individual page IDs within the same manuscript**
- These are NOT separate manifests but canvas IDs from the main manuscript

### 3. Current Implementation Issues

#### ✅ What Works Correctly
- **Multi-block detection**: `handleEManuscriptaTitleInfo()` correctly identifies titleinfo URLs
- **Block aggregation**: System attempts to process multiple thumbview blocks
- **IIIF integration**: Proper IIIF manifest parsing

#### ❌ Critical Flaws in Discovery Method

**Problem 1: Wrong Structure Page Approach**
```typescript
const structureUrl = `https://www.e-manuscripta.ch/${library}/content/structure/${manuscriptId}`;
```
- E-Manuscripta doesn't use `/structure/` endpoints
- This approach fails completely, returning 404s

**Problem 2: Manual Block Detection via URL Testing**
```typescript
// Test each zoom ID to see which ones have valid thumbview blocks
const thumbviewUrl = `https://www.e-manuscripta.ch/${library}/content/thumbview/${zoomId}`;
```
- Attempts to convert individual page IDs to thumbview blocks
- Fundamentally misunderstands E-Manuscripta architecture
- Results in only downloading single pages, not complete blocks

### 4. Correct Architecture Understanding

#### E-Manuscripta Block System
- **Single IIIF Manifest**: One manifest contains ALL pages across all blocks
- **No Separate Block Manifests**: Individual page IDs don't have their own manifests
- **Range-Based Organization**: Blocks are logical groupings within the main manifest

#### Proper Download Approach
1. **Always use IIIF manifest** as the source of truth
2. **Extract all canvas URLs** from `sequences[0].canvases[]`
3. **Build image URLs** using the pattern: `https://www.e-manuscripta.ch/download/webcache/{resolution}/{canvasId}`
4. **Ignore block boundaries** - download all pages sequentially

## 5. Solution Implementation

### Immediate Fix Required
Replace the entire multi-block discovery system with direct IIIF manifest processing:

```typescript
// CORRECT approach - use IIIF manifest directly
const manifestUrl = `https://www.e-manuscripta.ch/i3f/v20/${manuscriptId}/manifest`;
const manifest = await fetchJson(manifestUrl);
const canvases = manifest.sequences[0].canvases;
const pageLinks = canvases.map(canvas => {
    const canvasId = canvas['@id'].split('/').pop();
    return `https://www.e-manuscripta.ch/download/webcache/0/${canvasId}`;
});
```

### Maximum Resolution Testing Required
Based on canvas analysis, test these resolution parameters:
- `/webcache/0/` (original size)
- `/webcache/2000/` (width limit)
- `/webcache/full/` (if supported)

### URL Pattern Validation
- Canvas IDs: `5157223` to `5157626` (404 total)
- No gaps in sequence - all consecutive
- Each ID corresponds to one manuscript page

## 6. Test Case Verification

The manuscript "Statuta et Consuetudines Cartusianorum":
- **Expected Total Pages**: 404 (confirmed by IIIF manifest)
- **Current Downloads**: Only first block (~20 pages)
- **Missing Pages**: ~384 pages (95% of manuscript)

## 7. Implementation Priority

**CRITICAL**: This is a complete failure to download manuscripts correctly. Users are receiving 5% of the actual manuscript content. This requires immediate fix as it represents a fundamental misunderstanding of the E-Manuscripta platform architecture.

## 8. Recommendation

1. **Remove all multi-block detection logic** 
2. **Implement direct IIIF manifest processing**
3. **Test maximum resolution discovery**
4. **Validate with multiple E-Manuscripta manuscripts**
5. **Verify 404-page download for test manuscript**

The correct approach is much simpler than the current implementation - E-Manuscripta provides complete page information in their IIIF manifests, eliminating the need for complex block discovery.