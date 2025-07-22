# Unified Test/Production Workflow

## Problem Solved

Previously, manuscript library fixes were implemented separately in:
1. **Production code**: `src/main/services/EnhancedManuscriptDownloaderService.ts` 
2. **Validation scripts**: `.devkit/run-validation.js`

This caused maintenance issues:
- Fixes applied to production were forgotten in validation scripts
- Validation scripts diverged from production behavior
- Manual synchronization required between test and prod

## Solution: Shared Manifest Loaders

### Architecture

```
shared-manifest-loaders.js (Single source of truth)
├── Production Consumer: EnhancedManuscriptDownloaderService.ts
└── Validation Consumer: unified-validation.js
```

### Implementation

#### 1. Shared Manifest Loaders (`shared-manifest-loaders.js`)
- Contains all library-specific manifest loading logic
- Works in both Node.js (validation) and Electron (production)
- Single source of truth for all manuscript library integrations

#### 2. Production Consumer (`EnhancedManuscriptDownloaderService.ts`)
```typescript
import { SharedManifestLoaders } from '../../../.devkit/shared-manifest-loaders.js';

class EnhancedManuscriptDownloaderService {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders(this.electronFetch.bind(this));
    }

    async getManifestForLibrary(libraryId, url) {
        return await this.manifestLoaders.getManifestForLibrary(libraryId, url);
    }
}
```

#### 3. Validation Consumer (`unified-validation.js`)
```javascript
const { SharedManifestLoaders } = require('./shared-manifest-loaders.js');

class UnifiedValidator {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders(); // Uses Node.js fetch
    }

    async testLibrary(library) {
        const manifest = await this.manifestLoaders.getManifestForLibrary(library.library, library.url);
        // Rest of validation logic...
    }
}
```

## Benefits

### ✅ Synchronized Behavior
- Production and validation always use identical logic
- Fix once, works everywhere
- No more forgotten updates

### ✅ Easier Maintenance  
- Single file to update for library changes
- Clear separation of concerns
- Reduced code duplication

### ✅ Faster Development
- Validation scripts automatically inherit production fixes
- No need to maintain two codebases
- Consistent behavior across environments

## Workflow

### Adding New Library Support
1. Add new method to `SharedManifestLoaders` class
2. Add library mapping in `getManifestForLibrary()`
3. Test automatically works with `unified-validation.js`
4. Production automatically works when code is imported

### Fixing Existing Library
1. Update method in `SharedManifestLoaders` class
2. Run `node unified-validation.js` to test
3. Production automatically inherits fix on next build

### Library Validation Protocol
1. Fix library in `shared-manifest-loaders.js`
2. Run unified validation: `node unified-validation.js`
3. Inspect generated PDFs for manuscript content quality
4. Get user approval for validation results
5. Update production code to use shared loaders
6. Bump version and commit changes
7. Verify GitHub Actions build and telegram bot delivery

## File Structure

```
.devkit/
├── shared-manifest-loaders.js          # Single source of truth
├── unified-validation.js               # Validation consumer
└── docs/
    └── unified-test-prod-workflow.md    # This documentation

src/main/services/
└── EnhancedManuscriptDownloaderService.ts  # Production consumer
```

## Currently Supported Libraries (via Shared Loaders)

### ✅ Working Libraries
- **BDL Servizirl**: Fixed double-slash IIIF pattern (`cantaloupe//iiif/2/`)
- **Verona**: Fixed direct IIIF access with proper URL encoding
- **Vienna Manuscripta**: Direct URL construction pattern
- **BNE Spain**: SSL bypass for certificate issues
- **Karlsruhe**: Standard IIIF manifest
- **Library of Congress**: Standard IIIF manifest
- **University of Graz**: Standard IIIF manifest with retry logic

### ❌ Broken Libraries (Need Investigation)
- **MDC Catalonia**: IIIF manifest URL discovery issue
- **Grenoble**: DNS resolution failure  
- **Florence**: ContentDM integration issues

## Next Steps

1. ✅ Document unified workflow (this file)
2. ⏳ Update production `EnhancedManuscriptDownloaderService.ts`
3. ⏳ Bump version with BDL + Verona fixes
4. ⏳ Fix remaining broken libraries using unified approach

## Usage Examples

### Testing All Libraries
```bash
cd .devkit
node unified-validation.js
# Generates PDFs in unified-validation-results/FINAL_VALIDATION/
```

### Testing Single Library
```bash
# Edit TEST_LIBRARIES array in unified-validation.js
node unified-validation.js
```

### Adding New Library
```javascript
// In shared-manifest-loaders.js
async getNewLibraryManifest(url) {
    // Implementation here
    return { images: [...] };
}

// Add to getManifestForLibrary() switch statement
case 'new_library':
    return await this.getNewLibraryManifest(url);
```