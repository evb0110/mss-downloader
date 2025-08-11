# TypeScript Type Check Report

**Generated:** 11/08/2025, 15:18:11

## 📊 Summary

**Total Errors:** 115

### Error Categories

| Category | Count | Percentage | Description |
|----------|-------|------------|-------------|
| possiblyNull | 1 | 100.0% | Values that might be null or undefined |
| propertyDoesNotExist | 27 | 100.0% | Properties that don't exist on types |
| cannotFind | 16 | 100.0% | Cannot find name (missing imports/declarations) |
| typeAssignment | 7 | 100.0% | Type assignment/compatibility errors |
| argumentCount | 16 | 100.0% | Wrong number of arguments |
| unusedVariable | 22 | 100.0% | Unused variables or parameters |
| other | 26 | 100.0% | Other TypeScript errors |

### Top Problematic Files

| File | Error Count |
|------|-------------|
| src/main/services/EnhancedManuscriptDownloaderService.ts | 20 |
| src/main/services/EnhancedDownloadQueue.ts | 9 |
| src/main/services/library-loaders/GrazLoader.ts | 9 |
| src/main/services/DownloadQueue.ts | 8 |
| src/renderer/services/PdfRendererService.ts | 7 |
| src/main/services/UltraReliableBDLService.ts | 6 |
| src/main/services/DziImageProcessor.ts | 5 |
| src/main/services/library-loaders/LinzLoader.ts | 4 |
| src/renderer/main.ts | 4 |
| src/main/services/BDLParallelDownloader.ts | 3 |

## 🔧 How to Fix

1. **Run interactive fix:** `npm run typefix`
2. **Check specific file:** `npx tsc --noEmit src/path/to/file.ts`
3. **Watch mode:** `npm run typecheck:watch`

## 📝 Common Fixes

### Possibly Null/Undefined
Add null checks:
```typescript
// Before
const value = obj.property;

// After
const value = obj?.property;
```

### Property Does Not Exist
Fix typos or add type declarations:
```typescript
// Add missing property to interface
interface MyType {
  existingProp: string;
  newProp?: string; // Add this
}
```

