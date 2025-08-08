# Phase 2: Special Processors Support

## Objective
Ensure special library processors (Bordeaux tiles, Morgan .zif, E-manuscripta blocks) continue working with pre-sliced pageLinks.

## Critical Requirements

### Bordeaux Library (DirectTileProcessor)
**Lines:** 4445-4489

**Key Requirements:**
- Must preserve `manifest.requiresTileProcessor` flag
- Must preserve `manifest.tileConfig` object
- Must maintain `tileConfig.baseId`, `tileConfig.startPage`

**Implementation:**
```typescript
// In manifest building (Phase 1), ensure we preserve:
if (queueItem?.requiresTileProcessor) {
    manifest.requiresTileProcessor = true;
    manifest.tileConfig = queueItem.tileConfig;
}
```

### Morgan Library (.zif Processing)
**Special Handling:** Downloads .zif files, not regular images

**Requirements:**
- Preserve library identification (`manifest.library === 'morgan'`)
- Maintain .zif URL structure
- Handle TileEngineService processing

**No changes needed** - works with pageLinks as-is

### E-manuscripta (Block Discovery)
**Lines:** Referenced in manifest loading

**Requirements:**
- Dynamic page discovery through blocks
- Special URL patterns
- Preserve `manifest.pageBlocks` if present

**Implementation:**
```typescript
// Preserve block information if present
if (queueItem?.pageBlocks) {
    manifest.pageBlocks = queueItem.pageBlocks;
}
```

## Validation Checklist

### Bordeaux
- [ ] tileConfig preserved in manifest
- [ ] DirectTileProcessor receives correct baseId
- [ ] Page numbering calculation correct
- [ ] Tiles properly stitched

### Morgan
- [ ] .zif URLs correctly passed
- [ ] TileEngineService processes files
- [ ] PDF generation works

### E-manuscripta
- [ ] Block discovery preserved
- [ ] Dynamic page loading works
- [ ] Correct page ranges downloaded

## Error Handling
Add specific error messages for special processor failures:

```typescript
if (manifest.requiresTileProcessor && !manifest.tileConfig) {
    throw new Error('Bordeaux manuscript requires tileConfig but none provided');
}

if (manifest.library === 'morgan' && !imageUrl.includes('.zif')) {
    console.warn('Morgan library URL does not contain .zif extension');
}
```

## Testing Protocol
1. Download Bordeaux manuscript with auto-split
2. Download Morgan manuscript with auto-split
3. Download E-manuscripta with auto-split
4. Verify each part contains correct pages
5. Check PDF quality and completeness