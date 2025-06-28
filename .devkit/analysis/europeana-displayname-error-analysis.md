# Europeana Error Analysis: "manifest.displayName.replace is not a function"

## Problem Description

**Error URL:** https://www.europeana.eu/en/item/446/CNMD_0000171876

**Error Message:** `manifest.displayName.replace is not a function`

## Root Cause Analysis

### The Issue

The error occurs because the Europeana IIIF manifest processing code incorrectly handles the `label` property structure, resulting in an object being assigned to `displayName` instead of a string.

### Code Location

**File:** `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts`

**Error occurs at line 1654-1659:**
```typescript
const sanitizedName = manifest.displayName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // ❌ Error: displayName is an object, not a string
    .replace(/[\u00A0-\u9999]/g, '_')         
    .replace(/[^\w\s.-]/g, '_')               
    .replace(/\s+/g, '_')                     
    .replace(/_{2,}/g, '_')                   
```

**Bug in Europeana manifest processing (lines 4898-4912):**
```typescript
// Extract display name from manifest
let displayName = `Europeana_${recordId}`;
if (iiifManifest.label) {
    if (typeof iiifManifest.label === 'string') {
        displayName = iiifManifest.label;
    } else if (Array.isArray(iiifManifest.label)) {
        displayName = iiifManifest.label[0] || displayName;  // ❌ BUG HERE
    } else if (typeof iiifManifest.label === 'object') {
        // Handle multilingual labels (IIIF 3.0 format)
        const labelValues = Object.values(iiifManifest.label);
        if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
            displayName = (labelValues[0] as string[])[0] || displayName;
        }
    }
}
```

### Actual Europeana IIIF Manifest Structure

From the actual manifest at `https://iiif.europeana.eu/presentation/446/CNMD_0000171876/manifest`:

```json
{
  "label": [
    {
      "@value": "Roma, Biblioteca Vallicelliana, Manoscritti, ms.E 24"
    }
  ]
}
```

### The Problem

On line 4904: `displayName = iiifManifest.label[0] || displayName;`

- `iiifManifest.label[0]` returns `{ "@value": "Roma, Biblioteca Vallicelliana, Manoscritti, ms.E 24" }`
- This object is assigned to `displayName` instead of the string value
- Later, when `manifest.displayName.replace()` is called, it fails because objects don't have a `.replace()` method

## The Fix

**Line 4904 should be changed from:**
```typescript
displayName = iiifManifest.label[0] || displayName;
```

**To:**
```typescript
displayName = iiifManifest.label[0]?.['@value'] || iiifManifest.label[0] || displayName;
```

Or more robustly:
```typescript
const labelItem = iiifManifest.label[0];
if (typeof labelItem === 'string') {
    displayName = labelItem;
} else if (typeof labelItem === 'object' && labelItem['@value']) {
    displayName = labelItem['@value'];
}
```

## Type Safety Issues

The `ManuscriptManifest` interface correctly declares `displayName: string`, but the runtime code allows objects to be assigned to this property, causing type safety violations.

## Testing Validation

The actual IIIF manifest from Europeana confirms:
- `label` is an array
- Array contains objects with `@value` properties
- Current code incorrectly assigns the object instead of extracting the string value

## Impact

This bug affects all Europeana URLs where the IIIF manifest uses the standard IIIF array-of-objects label format, which appears to be the common case.

## Recommended Solution

Implement proper type checking and value extraction for the IIIF label property to handle the object structure correctly and ensure `displayName` is always a string as expected by the interface.