# E-Manuscripta.ch Single Page Download Bug Analysis

## Issue Summary
The e-manuscripta.ch downloader is only downloading the first page instead of the complete manuscript for URL: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497

## Current Implementation Analysis

### URL Structure
- URL format: `https://www.e-manuscripta.ch/{library}/content/zoom/{id}`
- Example: `https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497`
- Library: `zuzcmi`
- Manuscript ID: `3229497`

### Page Discovery Mechanism Issues

#### 1. Current Implementation Problem
The current implementation in `loadEManuscriptaManifest()` uses incorrect page discovery logic:

```typescript
// Look for page navigation to determine total pages
// Search for page navigation links like [1] [2] ... [464]
const pageNavRegex = /\[(\d+)\]/g;
const pageMatches = Array.from(viewerHtml.matchAll(pageNavRegex));
const pageNumbers = pageMatches.map(match => parseInt(match[1], 10));
const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
```

**This approach is fundamentally flawed** because:
- The regex `\[(\d+)\]` matches log page numbers like `[1]`, `[2]`, etc.
- It doesn't properly extract the actual page IDs from the dropdown
- It assumes a simple increment pattern which is incorrect

#### 2. Actual Page Structure Discovery

From the HTML analysis, the page navigation dropdown contains:
```html
<select id="goToPage" class="change offset" title="Gehe zu Seite" name="id">
<option value="3233118">[1] </option>
<option value="3233122">[2] </option>
<option value="3233110">[3] </option>
<option value="3233111">[4] </option>
<option value="3233112">[5] </option>
<option value="3233113">[6] </option>
<option value="3229515">[7] Ir</option>
<option value="3229517">[8] Iv</option>
<option value="3229698">[9] IIr</option>
<option value="3229699">[10] IIv</option>
<option value="3229497" selected>[11] 1r</option>
<option value="3229498">[12] 1v</option>
<!-- ... many more pages ... -->
<option value="3233119">[463] </option>
</select>
```

#### 3. Key Findings

1. **Total Pages**: This manuscript has **463 pages** (from [1] to [463])

2. **Non-Sequential IDs**: The page IDs are NOT sequential:
   - Page [1]: ID 3233118
   - Page [2]: ID 3233122  
   - Page [3]: ID 3233110
   - Page [11] (current): ID 3229497
   - Page [12]: ID 3229498
   - Page [463]: ID 3233119

3. **Image URL Pattern**: 
   - Current URL being downloaded: `https://www.e-manuscripta.ch/{library}/download/webcache/0/{imageId}`
   - Example: `https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/3229497`

4. **Increment Pattern Logic Failure**:
   ```typescript
   // Try to find the increment pattern by looking at navigation
   const nextPagePattern = new RegExp(`/${library}/content/zoom/(\\d+)`, 'g');
   const navigationMatches = Array.from(viewerHtml.matchAll(nextPagePattern));
   const navigationIds = [...new Set(navigationMatches.map(match => parseInt(match[1], 10)))];
   
   // Generate page links using the detected increment
   const baseId = parseInt(manuscriptId, 10);
   for (let i = 0; i < totalPages; i++) {
       const imageId = baseId + (i * increment);
       const imageUrl = `https://www.e-manuscripta.ch/${library}/download/webcache/0/${imageId}`;
       pageLinks.push(imageUrl);
   }
   ```
   
   This logic assumes a simple arithmetic progression which is incorrect for e-manuscripta.ch.

## Root Cause

The page discovery mechanism is **fundamentally broken** because:

1. **Wrong regex pattern**: Looking for `\[(\d+)\]` instead of parsing the dropdown options
2. **Incorrect assumption**: Assuming sequential ID increments when IDs are non-sequential  
3. **Missing page ID extraction**: Not extracting the actual `value` attributes from `<option>` elements
4. **Faulty increment calculation**: The increment logic cannot handle non-sequential IDs

## Correct Solution Approach

The fix should:

1. **Parse the page dropdown properly**:
   ```typescript
   const pageDropdownRegex = /<select[^>]*id="goToPage"[^>]*>.*?<\/select>/s;
   const optionRegex = /<option\s+value="(\d+)"[^>]*>\[(\d+)\][^<]*<\/option>/g;
   ```

2. **Extract all page IDs directly**:
   ```typescript
   const pageMatches = Array.from(viewerHtml.matchAll(optionRegex));
   const pageData = pageMatches.map(match => ({
       id: match[1],           // actual page ID 
       pageNumber: parseInt(match[2], 10)  // logical page number
   }));
   ```

3. **Generate URLs using actual IDs**:
   ```typescript
   const pageLinks = pageData.map(page => 
       `https://www.e-manuscripta.ch/${library}/download/webcache/0/${page.id}`
   );
   ```

## Impact

This bug causes:
- Only the first page (current page) to be downloaded
- Users receiving incomplete manuscripts (1 page instead of 463 pages)
- Poor user experience and data loss

## Priority

**HIGH** - This is a critical functionality bug affecting the core purpose of the application.