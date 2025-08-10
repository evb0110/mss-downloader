# Phase 1: Core Utilities Extraction (SAFEST)

## Overview
Extract the SAFEST methods first - pure utility functions with minimal or no dependencies.

## Target Modules

### 1. UrlUtils.ts (~150 lines)
**Location**: `src/main/utils/UrlUtils.ts`

#### Methods to Extract:
```typescript
// Lines 126-188: sanitizeUrl (pure function, minimal deps)
// Lines 612-683: detectLibrary (pure function, no deps)  
// Lines 11597-11638: detectLibraryFromUrl (pure function, no deps)
```

#### Extraction Details:
```typescript
// BEFORE (in main class):
private sanitizeUrl(url: string): { url: string; wasModified: boolean } {
    // ... 62 lines of implementation
}

public detectLibrary(url: string): string | null {
    // ... 71 lines of implementation  
}

private detectLibraryFromUrl(url: string): string | null {
    // ... 41 lines of implementation
}

// AFTER (new UrlUtils.ts):
export class UrlUtils {
    static sanitizeUrl(url: string): { url: string; wasModified: boolean } {
        // ... same implementation
        // Remove comprehensiveLogger dependency or inject it
    }
    
    static detectLibrary(url: string): string | null {
        // ... exact same implementation (no dependencies)
    }
    
    static detectLibraryFromUrl(url: string): string | null {
        // ... exact same implementation (no dependencies)
    }
}

// In main class - replace calls:
// OLD: this.sanitizeUrl(url)
// NEW: UrlUtils.sanitizeUrl(url)
```

#### Import Changes:
```typescript
// Add to EnhancedManuscriptDownloaderService.ts:
import { UrlUtils } from '../utils/UrlUtils';

// Replace method calls:
// this.sanitizeUrl() -> UrlUtils.sanitizeUrl()
// this.detectLibrary() -> UrlUtils.detectLibrary() 
// this.detectLibraryFromUrl() -> UrlUtils.detectLibraryFromUrl()
```

#### Risk Assessment: **LOW**
- Pure static functions
- Minimal external dependencies
- No `this` binding issues
- Easy to test in isolation

---

### 2. TimeUtils.ts (~50 lines)
**Location**: `src/main/utils/TimeUtils.ts`

#### Methods to Extract:
```typescript
// Lines 515-520: calculateRetryDelay (minimal deps)
// Lines 525-539: formatETA (pure function, no deps)
// Lines 544-546: sleep (pure function, no deps)
```

#### Extraction Details:
```typescript
// AFTER (new TimeUtils.ts):
export class TimeUtils {
    static calculateRetryDelay(attempt: number, baseDelay: number = 1000): number {
        // Move configService dependency to parameter or remove
        return Math.min(baseDelay * Math.pow(2, attempt), 30000);
    }
    
    static formatETA(seconds: number): string {
        // ... exact same implementation (no dependencies)
    }
    
    static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

#### Risk Assessment: **LOW**  
- Pure utility functions
- No complex dependencies
- Easy to extract safely

---

### 3. LibraryConstants.ts (~100 lines)
**Location**: `src/main/constants/LibraryConstants.ts`

#### Constants to Extract:
```typescript
// Lines 23-24: MIN_VALID_IMAGE_SIZE_BYTES
// SUPPORTED_LIBRARIES constant (mentioned in analysis)
// PROXY_SERVERS constant (mentioned in analysis)  
// NORWEGIAN_PROXIES constant (mentioned in analysis)
```

#### Extraction Details:
```typescript
// AFTER (new LibraryConstants.ts):
export const MIN_VALID_IMAGE_SIZE_BYTES = 1024;

export const SUPPORTED_LIBRARIES = [
    // ... all supported library identifiers
];

export const PROXY_SERVERS = [
    // ... proxy server configurations
];

export const NORWEGIAN_PROXIES = [
    // ... Norwegian proxy configurations
];

// Export types
export type TLibrary = /* ... */;
```

#### Risk Assessment: **ZERO RISK**
- Just constants and type definitions
- No runtime logic
- No dependencies

---

### 4. ManuscriptUtils.ts (~80 lines)
**Location**: `src/main/utils/ManuscriptUtils.ts`

#### Methods to Extract:
```typescript
// Lines 4355-4374: extractManuscriptIdFromUrl (pure function)
// Lines 4375-4381: buildDescriptiveName (pure function, calls extractManuscriptIdFromUrl)  
// Lines 503-510: getSupportedLibraries (pure function, no deps)
```

#### Extraction Details:
```typescript
// AFTER (new ManuscriptUtils.ts):
export class ManuscriptUtils {
    static extractManuscriptIdFromUrl(url: string): string {
        // ... exact same implementation (no dependencies)
    }
    
    static buildDescriptiveName(baseName: string, url: string): string {
        const manuscriptId = ManuscriptUtils.extractManuscriptIdFromUrl(url);
        return `${baseName}_${manuscriptId}`;
    }
    
    static getSupportedLibraries(): string[] {
        return SUPPORTED_LIBRARIES; // Import from LibraryConstants
    }
}
```

#### Risk Assessment: **LOW**
- Pure utility functions
- Internal dependencies only (between extracted methods)
- No external service calls

## Implementation Steps

### Step 1: Create Directory Structure
```bash
mkdir -p src/main/utils
mkdir -p src/main/constants
```

### Step 2: Extract Constants First (Zero Risk)
1. Create `LibraryConstants.ts`
2. Move all constants
3. Update imports in main class
4. Test build: `npm run build`

### Step 3: Extract TimeUtils (Low Risk)
1. Create `TimeUtils.ts`  
2. Copy methods as static functions
3. Update method calls in main class
4. Test build: `npm run build`

### Step 4: Extract ManuscriptUtils (Low Risk)
1. Create `ManuscriptUtils.ts`
2. Copy methods as static functions  
3. Update method calls in main class
4. Test build: `npm run build`

### Step 5: Extract UrlUtils (Low Risk)
1. Create `UrlUtils.ts`
2. Handle comprehensiveLogger dependency carefully
3. Update method calls in main class
4. Test build: `npm run build`

## Testing After Phase 1

### Build Test
```bash
npm run build
npm run lint
```

### Functional Test
```typescript
// Quick test script to verify extracted utilities work:
import { UrlUtils } from './src/main/utils/UrlUtils';
import { TimeUtils } from './src/main/utils/TimeUtils';

console.log('Testing URL detection:', UrlUtils.detectLibrary('https://gallica.bnf.fr/ark:/12148/btv1b10722282t'));
console.log('Testing ETA formatting:', TimeUtils.formatETA(3661));
```

### Integration Test
- Download 1 manuscript from Gallica (simple IIIF)
- Verify PDF generation works
- Check no errors in console

## Rollback Instructions

If ANY issues occur:
```bash
git checkout -- src/main/services/EnhancedManuscriptDownloaderService.ts
rm -rf src/main/utils
rm -rf src/main/constants  
npm run build
```

## Expected Results After Phase 1

- **Main class**: Reduced from 11,639 to ~11,400 lines
- **New modules**: 4 modules totaling ~380 lines
- **Functionality**: 100% preserved
- **Build**: Passes without errors
- **Downloads**: Work exactly as before

## Next Phase Preparation

Once Phase 1 is successfully completed and tested:
- Move to Phase 2 (PDF conversion)
- Only proceed if Phase 1 is 100% successful
- Any issues = STOP and reassess approach