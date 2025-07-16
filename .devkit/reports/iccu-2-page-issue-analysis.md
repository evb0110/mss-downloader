# ICCU API 2-Page Issue Analysis

## Issue Summary
The ICCU implementation is correctly identifying and blocking incomplete manuscripts. The URL `https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest` is a **folio-level manifest** containing only 2 pages from a 148-folio manuscript.

## Technical Details

### Manifest Analysis
- **URL**: `https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest`
- **Type**: IIIF v3 Presentation API manifest
- **Container ID**: `avQYk0e` (appears to be folio-specific)
- **Pages Found**: 2
- **Expected Pages**: ~148 folios (from metadata: "cc. IV + 148 + I")

### Page Details
1. **Page 1**: c. 84r (presenza di notazione musicale)
   - Image URL: `https://iiif-dam.iccu.sbn.it/iiif/2/dw0El1e/full/max/0/default.jpg`
2. **Page 2**: c. 8r (pagina ornata)
   - Image URL: `https://iiif-dam.iccu.sbn.it/iiif/2/elRvPrb/full/max/0/default.jpg`

### Manuscript Metadata
- **Title**: Roma, Biblioteca Vallicelliana, Manoscritti, ms. B 50
- **CNMD ID**: 0000016463
- **Physical Description**: Membranaceo; cc. IV + 148 + I
- **Date**: 901-1000 (10th century)
- **Signature**: ms. B 50

## Code Behavior

The validation logic in `loadVallicellianManifest` is working correctly:

```typescript
// CRITICAL: Detect severely incomplete manuscripts (less than 10% of expected)
if (expectedFolios > 0 && pageLinks.length < expectedFolios * 0.1) {
    const incompleteError = `INCOMPLETE MANUSCRIPT DETECTED...`;
    throw new Error(incompleteError);
}
```

With 2 pages out of 148 expected (1.35%), this triggers the incomplete manuscript detection.

## Root Cause

This is **not a bug** in the downloader. The issue is that:

1. The URL provided points to a folio-level manifest, not a complete manuscript manifest
2. ICCU's DAM system allows viewing individual folios with their own manifest URLs
3. The container ID `avQYk0e` appears to reference a specific selection of folios, not the entire manuscript

## Solution

Users experiencing this issue need to:

1. Find the complete manuscript manifest URL (not a folio-level URL)
2. Search for the manuscript using the CNMD ID: 0000016463
3. Access the manuscript through the main ICCU catalog: https://manus.iccu.sbn.it
4. Look for a container ID that represents the full manuscript

## Validation Success

The code is correctly:
- Detecting incomplete manuscripts
- Parsing physical description metadata
- Calculating expected folio counts
- Preventing users from downloading partial manuscripts thinking they're complete
- Providing helpful error messages with solutions

## Recommendation

No code changes needed. The validation is working as designed to protect users from incomplete downloads. The error message already provides clear guidance on finding the complete manuscript.