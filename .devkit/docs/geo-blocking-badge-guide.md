# Geo-Blocking Badge Implementation Guide

This guide explains how to add geo-blocking badges to libraries in the MSS Downloader.

## Overview

The geo-blocking badge system allows marking libraries that may not be accessible from all geographic regions due to IP restrictions. The badge appears as an orange "Geo-Restricted" label next to the library name.

## Implementation Details

### 1. Data Structure

The `LibraryInfo` interface includes a `geoBlocked` property:

```typescript
export interface LibraryInfo {
  name: string;
  example: string;
  description: string;
  status?: 'temporarily_unavailable' | 'operational';
  geoBlocked?: boolean; // Add this property
}
```

### 2. Library Configuration

To mark a library as geo-blocked, add the `geoBlocked: true` property to its entry in `SUPPORTED_LIBRARIES`:

```typescript
{
  name: 'University of Graz',
  example: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
  description: 'University of Graz digital manuscript collection with IIIF support',
  geoBlocked: true, // Add this line
},
```

### 3. UI Display

The Vue component automatically displays the badge for any library with `geoBlocked: true`:

```vue
<span 
  v-if="library.geoBlocked" 
  class="status-badge geo-blocked"
  :title="'This library may not be accessible from all geographic regions due to IP restrictions'"
>
  Geo-Restricted
</span>
```

### 4. Styling

The badge uses orange styling to distinguish it from other status badges:

```scss
.status-badge.geo-blocked {
  background: #f59e0b;
  color: white;
}
```

## Adding Geo-Blocking to Other Libraries

When you need to add geo-blocking badges to other libraries:

1. **Identify the library** in `/src/main/services/EnhancedManuscriptDownloaderService.ts`
2. **Add the property** `geoBlocked: true` to the library object
3. **Test the implementation** using the validation script
4. **No Vue component changes needed** - the badge will automatically appear

### Example: Adding Geo-Blocking to Norwegian National Library

```typescript
{
  name: 'Norwegian National Library (nb.no)',
  example: 'https://www.nb.no/items/1ef274e1cff5ab191d974e96d09c4cc1?page=0',
  description: 'National Library of Norway digital manuscripts (Note: May require Norwegian IP for image access due to geo-restrictions)',
  geoBlocked: true, // Add this line
},
```

## When to Use Geo-Blocking Badges

Use geo-blocking badges when:

- Libraries are known to restrict access based on IP geolocation
- Users commonly report "access denied" or connection issues from certain regions
- The library explicitly states geographic restrictions in their terms
- You've verified that the library works from some regions but not others

## Testing

Use the validation script to verify implementation:

```bash
node .devkit/validation/check-geo-badge.cjs
```

This ensures:
- The LibraryInfo interface is properly extended
- Libraries are correctly marked in the data
- The Vue component displays badges correctly
- CSS styling is applied

## User Experience

The geo-blocking badge:
- Uses orange color (#f59e0b) to indicate caution/warning
- Shows "Geo-Restricted" text for clarity
- Includes a tooltip explaining the restriction
- Appears alongside other status badges (like "Temporarily Unavailable")

This helps users understand why they might experience access issues with certain libraries.