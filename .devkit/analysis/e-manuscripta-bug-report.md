# E-Manuscripta.ch Single Page Download Bug Report

**Date**: 2025-01-29  
**URL**: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497  
**Issue**: Only downloading first page instead of complete 463-page manuscript

## Executive Summary

The e-manuscripta.ch library implementation contains a critical bug in page discovery that results in downloading only the first page instead of the complete manuscript. The issue stems from incorrect parsing of the page navigation structure and a flawed assumption about sequential ID increments.

## Technical Analysis

### Current Broken Implementation

#### 1. Page Count Detection - INCORRECT
```typescript
// Current flawed regex searching for [1] [2] patterns
const pageNavRegex = /\[(\d+)\]/g;
const pageMatches = Array.from(viewerHtml.matchAll(pageNavRegex));
const pageNumbers = pageMatches.map(match => parseInt(match[1], 10));
const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
```

**Problem**: This only finds bracketed numbers in text, not the actual page structure.

#### 2. Page ID Generation - INCORRECT  
```typescript
// Assumes sequential increments - WRONG
const baseId = parseInt(manuscriptId, 10);
for (let i = 0; i < totalPages; i++) {
    const imageId = baseId + (i * increment);
    const imageUrl = `https://www.e-manuscripta.ch/${library}/download/webcache/0/${imageId}`;
    pageLinks.push(imageUrl);
}
```

**Problem**: Page IDs are NOT sequential on e-manuscripta.ch.

### Actual Page Structure

The HTML contains a dropdown with the complete page listing:

```html
<select id="goToPage" class="change offset" title="Gehe zu Seite" name="id">
    <option value="3233118">[1] </option>      <!-- Page 1: ID 3233118 -->
    <option value="3233122">[2] </option>      <!-- Page 2: ID 3233122 -->
    <option value="3233110">[3] </option>      <!-- Page 3: ID 3233110 -->
    <option value="3233111">[4] </option>      <!-- Page 4: ID 3233111 -->
    <!-- ... -->
    <option value="3229497" selected>[11] 1r</option>  <!-- Current page -->
    <option value="3229498">[12] 1v</option>   <!-- Next page -->
    <!-- ... 463 total pages ... -->
    <option value="3233119">[463] </option>    <!-- Last page: ID 3233119 -->
</select>
```

### Evidence of Non-Sequential IDs

| Page Number | Page ID | Difference from Previous |
|-------------|---------|-------------------------|
| [1]         | 3233118 | -                       |
| [2]         | 3233122 | +4                      |
| [3]         | 3233110 | -12                     |
| [4]         | 3233111 | +1                      |
| [11]        | 3229497 | -3614                   |
| [12]        | 3229498 | +1                      |

**Clear evidence**: IDs are non-sequential and cannot be generated arithmetically.

## Correct Implementation

### 1. Extract Page Navigation Dropdown
```typescript
// Find the page dropdown in HTML
const pageDropdownMatch = viewerHtml.match(/<select[^>]*id="goToPage"[^>]*>(.*?)<\/select>/s);
if (!pageDropdownMatch) {
    throw new Error('Could not find page navigation dropdown');
}

const dropdownHTML = pageDropdownMatch[1];
```

### 2. Parse All Page Options
```typescript
// Extract all page options with their IDs and page numbers
const optionRegex = /<option\s+value="(\d+)"[^>]*>\[(\d+)\][^<]*<\/option>/g;
const pageOptions = [];
let match;

while ((match = optionRegex.exec(dropdownHTML)) !== null) {
    pageOptions.push({
        id: match[1],                           // actual page ID
        pageNumber: parseInt(match[2], 10)      // logical page number [1], [2], etc.
    });
}

// Sort by page number to ensure correct order
pageOptions.sort((a, b) => a.pageNumber - b.pageNumber);
```

### 3. Generate Correct Image URLs
```typescript
// Generate image URLs using actual page IDs
const pageLinks = pageOptions.map(page => 
    `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.id}`
);

const totalPages = pageOptions.length;
console.log(`e-manuscripta: Found ${totalPages} pages for ${displayName}`);
```

## Verification

### Test URLs for Manuscript 3229497

- **Page 1**: https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3233118
- **Page 2**: https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3233122  
- **Page 11** (current): https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3229497
- **Page 12**: https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3229498
- **Page 463** (last): https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3233119

### Expected Results After Fix

- **Total pages**: 463 pages (not 1)
- **All pages downloadable**: Complete manuscript from first to last page
- **Correct sequence**: Pages in proper logical order

## Impact Assessment

### Before Fix
- ❌ Downloads only 1 page out of 463
- ❌ Users receive incomplete manuscripts  
- ❌ 99.8% data loss
- ❌ Poor user experience

### After Fix  
- ✅ Downloads all 463 pages
- ✅ Complete manuscript preservation
- ✅ 100% data accuracy
- ✅ Proper functionality restored

## Recommendation

**Immediate Action Required**: This is a **critical bug** that renders the e-manuscripta.ch library integration nearly useless. The fix should be implemented with high priority to restore proper functionality.

## Files to Modify

1. `/src/main/services/EnhancedManuscriptDownloaderService.ts`
   - Method: `loadEManuscriptaManifest()`
   - Replace page discovery logic with correct dropdown parsing

## Testing Requirements

After implementation:
1. Test with the failing URL: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497
2. Verify 463 pages are detected and downloaded
3. Test with other e-manuscripta.ch URLs to ensure broad compatibility
4. Validate proper page sequencing and URL generation