# Fix for Morgan Library Page Extraction Issue

## Problem
User reports that only 1 page is offered for download from Morgan Library URLs. Testing reveals:
- The main collection page only contains 1 facsimile image (usually the cover)
- The code finds 16 individual page references but doesn't properly extract images from them
- The download pattern being searched for in individual pages is incorrect

## Root Cause
1. The `/thumbs` URL pattern is outdated - it redirects or returns 404
2. The main collection page only contains the cover image
3. The individual page fetching looks for wrong pattern: `/sites/default/files/images/collection/download/`
4. The actual pattern on individual pages is: `/sites/default/files/facsimile/[ID]/[filename].jpg`

## Solution

### Fix 1: Remove automatic /thumbs appending
The code should NOT append `/thumbs` to Morgan URLs anymore, as this pattern is deprecated.

### Fix 2: Fix the individual page image extraction
The download pattern regex on line 1407 needs to be updated to match the actual facsimile pattern.

### Current Code (line 1407):
```typescript
const downloadMatch = individualPageContent.match(/\/sites\/default\/files\/images\/collection\/download\/([^"']+\.jpg)/);
```

### Fixed Code:
```typescript
// Look for facsimile images on individual pages
const facsimileMatch = individualPageContent.match(/\/sites\/default\/files\/facsimile\/[^"']+\/([^"']+\.jpg)/);
if (facsimileMatch) {
    const downloadUrl = `${baseUrl}${facsimileMatch[0]}`;
    imagesByPriority[1].push(downloadUrl);
    console.log(`Morgan: Found high-res facsimile: ${facsimileMatch[1]}`);
}
```

### Fix 3: Ensure individual pages are actually fetched
The code correctly identifies individual page numbers but needs to ensure it's fetching them when the main page doesn't have enough images.

## Testing Results
- Lindau Gospels: Should extract 16 pages instead of 1
- Arenberg Gospels: Should extract 12 pages instead of 1
- Each individual page contains its corresponding facsimile image

## Implementation Priority
This is a critical bug affecting all Morgan Library downloads. Users are only getting cover pages instead of full manuscripts.