# Phase 4: Library Loaders by Region (MEDIUM-HIGH RISK)

## Prerequisites
- ✅ Phases 1, 2, and 3 completed successfully
- ✅ Main class reduced to ~10,700 lines
- ✅ All utility functions extracted
- ✅ Build and tests passing

## ⚠️ WARNING: HIGH COMPLEXITY PHASE
This phase involves extracting the most complex parts of the system. Proceed with EXTREME caution.

## Overview
Group library-specific manifest loaders by geographic region and technical similarity. Each module will contain related loaders with similar implementation patterns.

## Regional Grouping Strategy

### 1. StandardIiifLoaders.ts (~800 lines)
**Location**: `src/main/loaders/StandardIiifLoaders.ts`

#### Libraries Included:
```typescript
// Standard IIIF implementations (LOW complexity):
- loadIIIFManifest (lines 2925-3055) - 130 lines
- loadDurhamManifest (lines 3131-3153) - 22 lines  
- loadUgentManifest (lines 3154-3172) - 18 lines
- loadBLManifest (lines 3173-3203) - 30 lines
- loadCudlManifest (lines 5884-5931) - 47 lines
- loadTrinityCamManifest (lines 5932-6034) - 102 lines
- loadBerlinManifest (lines 7836-7925) - 89 lines
- loadFuldaManifest (lines 11057-11146) - 89 lines
- loadSharedCanvasManifest (lines 3730-3741) - 11 lines
- loadRbmeManifest (lines 6532-6683) - 151 lines
```

#### Implementation Pattern:
```typescript
export class StandardIiifLoaders {
    constructor(
        private fetchDirect: (url: string, options?: any) => Promise<Response>,
        private loadGenericIIIF: (url: string, options?: any) => Promise<any>
    ) {}

    async loadIIIFManifest(url: string): Promise<ManuscriptManifest> {
        // ... exact same implementation
        // Replace this.fetchDirect with this.fetchDirect
        // Replace this.loadIIIFManifest with this.loadGenericIIIF where appropriate
    }

    // ... other IIIF loaders
}
```

---

### 2. FrenchLibraryLoaders.ts (~600 lines)
**Location**: `src/main/loaders/FrenchLibraryLoaders.ts`

#### Libraries Included:
```typescript
// French libraries with similar patterns:
- loadGallicaManifest (lines 2405-2544) - 139 lines
- loadGrenobleManifest (lines 2545-2623) - 78 lines  
- loadCeciliaManifest (lines 3272-3366) - 94 lines
- loadIrhtManifest (lines 3367-3451) - 84 lines
- loadDijonManifest (lines 3638-3671) - 33 lines
- loadLaonManifest (lines 3672-3729) - 57 lines
- loadSaintOmerManifest (lines 3742-3835) - 93 lines
- loadRouenManifest (lines 10689-10878) - 189 lines
```

---

### 3. GermanAustrianLoaders.ts (~900 lines)
**Location**: `src/main/loaders/GermanAustrianLoaders.ts`

#### Libraries Included:
```typescript
// German and Austrian libraries:
- loadKarlsruheManifest (lines 2624-2747) - 123 lines
- loadMunichManifest (lines 2836-2924) - 88 lines
- loadUnifrManifest (lines 3204-3271) - 67 lines
- loadGrazManifest (lines 7133-7418) - 285 lines
- loadCologneManifest (lines 7419-7553) - 134 lines  
- loadViennaManuscriptaManifest (lines 7554-7708) - 154 lines
- loadFreiburgManifest (lines 10879-11056) - 177 lines
- loadWolfenbuettelManifest (lines 11147-11311) - 164 lines
- loadHhuManifest (lines 11312-11494) - 182 lines
- loadGAMSManifest (lines 11499-11595) - 96 lines
- loadOnbManifest (lines 10590-10688) - 98 lines
```

---

### 4. ItalianLibraryLoaders.ts (~1200 lines)
**Location**: `src/main/loaders/ItalianLibraryLoaders.ts`

#### Libraries Included:
```typescript
// Italian libraries (most complex due to geo-blocking):
- loadUnicattManifest (lines 5733-5883) - 150 lines
- loadInternetCulturaleManifest (lines 6937-7132) - 195 lines
- loadRomeManifest (lines 7709-7835) - 126 lines
- loadModenaManifest (lines 8004-8148) - 144 lines
- loadBDLManifest (lines 8149-8318) - 169 lines
- loadMonteCassinoManifest (lines 9126-9250) - 124 lines
- loadVallicellianManifest (lines 9251-9351) - 100 lines
- loadOmnesVallicellianManifest (lines 9518-9596) - 78 lines
- loadIccuApiManifest (lines 9597-9665) - 68 lines  
- loadVeronaManifest (lines 9666-9859) - 193 lines
- loadFlorenceManifest (lines 10459-10589) - 130 lines
```

---

### 5. AmericanLibraryLoaders.ts (~1000 lines)
**Location**: `src/main/loaders/AmericanLibraryLoaders.ts`

#### Libraries Included:
```typescript
// American libraries with custom implementations:
- loadMorganManifest (lines 1854-2257) - 403 lines
- loadNyplManifest (lines 2258-2404) - 146 lines
- loadManchesterManifest (lines 2748-2835) - 87 lines
- loadVatlibManifest (lines 3056-3130) - 74 lines
- loadLocManifest (lines 3452-3637) - 185 lines
- loadTorontoManifest (lines 3836-3990) - 154 lines
- loadParkerManifest (lines 6684-6780) - 96 lines
```

## 🚨 CRITICAL IMPLEMENTATION CHALLENGES

### Challenge 1: `this` Binding Issues
**Problem**: All loader methods currently use `this.fetchDirect()`, `this.sleep()`, etc.

**Solution**: Constructor injection pattern
```typescript
export class ItalianLibraryLoaders {
    constructor(
        private fetchDirect: typeof EnhancedManuscriptDownloaderService.prototype.fetchDirect,
        private validateInternetCulturaleImage: typeof ValidationUtils.validateInternetCulturaleImage,
        private sleep: typeof TimeUtils.sleep,
        // ... other dependencies
    ) {}
}
```

### Challenge 2: Circular Dependencies
**Problem**: Main orchestrator calls all loaders, loaders might need main class methods.

**Solution**: Dependency injection + interface definition
```typescript
// Define interface for required methods
interface LoaderDependencies {
    fetchDirect: (url: string, options?: any) => Promise<Response>;
    sleep: (ms: number) => Promise<void>;
    // ... other required methods
}

// Main class implements and injects
export class EnhancedManuscriptDownloaderService implements LoaderDependencies {
    private italianLoaders: ItalianLibraryLoaders;
    
    constructor(manifestCache?: ManifestCache) {
        // ... existing initialization
        this.italianLoaders = new ItalianLibraryLoaders(this);
    }
}
```

### Challenge 3: loadManifest Orchestrator
**Problem**: The main `loadManifest` method (lines 1565-1853) calls ALL library loaders.

**Current Structure**:
```typescript
public async loadManifest(url: string): Promise<ManuscriptManifest> {
    const library = this.detectLibrary(url);
    
    switch (library) {
        case 'morgan': return await this.loadMorganManifest(url);
        case 'gallica': return await this.loadGallicaManifest(url);
        // ... 50+ more cases
    }
}
```

**Proposed Solution**: Registry pattern
```typescript
// Define loader registry
interface LibraryLoader {
    canHandle(library: string): boolean;
    loadManifest(url: string): Promise<ManuscriptManifest>;
}

export class LoaderRegistry {
    private loaders: LibraryLoader[] = [];
    
    register(loader: LibraryLoader) {
        this.loaders.push(loader);
    }
    
    async loadManifest(url: string, library: string): Promise<ManuscriptManifest> {
        const loader = this.loaders.find(l => l.canHandle(library));
        if (!loader) throw new Error(`No loader for library: ${library}`);
        return await loader.loadManifest(url);
    }
}

// Main class becomes:
public async loadManifest(url: string): Promise<ManuscriptManifest> {
    const library = UrlUtils.detectLibrary(url);
    return await this.loaderRegistry.loadManifest(url, library);
}
```

## ALTERNATIVE SAFER APPROACH

Given the complexity, consider a **HYBRID APPROACH**:

### Option A: Keep Main Orchestrator, Extract Groups
- Keep `loadManifest` in main class (avoid circular dependencies)
- Extract library groups as separate classes
- Use dependency injection for shared methods
- Main class instantiates and calls appropriate loader groups

### Option B: Gradual Extraction by Complexity
1. **First**: Extract only the SIMPLEST loaders (Standard IIIF)
2. **Test thoroughly** before proceeding
3. **Second**: Extract one regional group at a time
4. **Stop immediately** if any issues occur

## RECOMMENDED IMPLEMENTATION PLAN

### Step 1: Start with Standard IIIF Loaders Only
```typescript
// Extract ONLY the simplest, most standard loaders first
// These have minimal dependencies and similar patterns
export class StandardIiifLoaders {
    // Only extract 5-6 of the simplest loaders
    // Test extensively before adding more
}
```

### Step 2: Modify Main Class to Use Extracted Loaders
```typescript
export class EnhancedManuscriptDownloaderService {
    private standardLoaders: StandardIiifLoaders;
    
    constructor(manifestCache?: ManifestCache) {
        this.standardLoaders = new StandardIiifLoaders(
            this.fetchDirect.bind(this),
            // ... other bound methods
        );
    }
    
    public async loadManifest(url: string): Promise<ManuscriptManifest> {
        const library = UrlUtils.detectLibrary(url);
        
        // Route ONLY extracted libraries to new loader
        if (this.standardLoaders.canHandle(library)) {
            return await this.standardLoaders.loadManifest(url, library);
        }
        
        // Keep existing implementation for all others
        switch (library) {
            case 'morgan': return await this.loadMorganManifest(url);
            // ... keep all non-extracted loaders as-is
        }
    }
}
```

### Step 3: Test Extensively
- Verify extracted libraries work correctly
- Ensure non-extracted libraries still work  
- Check no regressions in main workflow
- Test complex manuscripts from extracted libraries

### Step 4: Only If Step 3 Succeeds - Extract Next Group
- Choose next simplest group (French libraries)
- Follow same pattern
- Test extensively again

## SAFETY RULES FOR PHASE 4

1. **NEVER extract more than 5-6 loaders at once**
2. **ALWAYS test after each extraction**
3. **STOP IMMEDIATELY if any issues occur**
4. **Keep dependency injection simple**
5. **Preserve all existing method signatures**
6. **Don't modify the complex loaders' internal logic**

## Testing Strategy

### After Each Loader Group Extraction:
```bash
# Build verification
npm run build
npm run lint

# Test 2-3 manuscripts from the extracted library group
# Test 2-3 manuscripts from non-extracted libraries
# Verify no regressions in PDF generation
# Check memory usage hasn't increased significantly
```

### Integration Testing Script:
```typescript
// .devkit/testing/test-loader-groups.cjs
async function testLoaderGroups() {
    // Test Standard IIIF loaders
    await testManuscript('https://cudl.lib.cam.ac.uk/iiif/MS-DD-00001-00106');
    await testManuscript('https://iiif.bodleian.ox.ac.uk/iiif/manifest/test');
    
    // Test non-extracted loaders still work
    await testManuscript('https://gallica.bnf.fr/iiif/ark:/12148/btv1b10722282t/manifest.json');
    
    console.log('✅ All loader groups working correctly');
}
```

## Expected Results After Phase 4

**If successful**:
- Main class: ~8,000-9,000 lines (major reduction)
- 5 new loader modules: ~4,500 lines total
- Clear separation by geographic region
- Maintainable, testable code structure

**If issues occur**:
- Immediately revert all changes
- Main class returns to ~10,700 lines
- Re-evaluate if further refactoring is worth the risk

## SUCCESS CRITERIA

- [ ] Build completes without errors
- [ ] All library types download correctly  
- [ ] PDF generation works for all libraries
- [ ] No performance regressions
- [ ] Memory usage unchanged
- [ ] Code is more maintainable
- [ ] Each module is under 1,200 lines

## FAILURE CRITERIA (ABORT PHASE 4)

- ❌ Any library download fails
- ❌ Build errors
- ❌ Performance significantly degraded
- ❌ Complex circular dependency issues
- ❌ `this` binding problems cause runtime errors
- ❌ Any existing functionality breaks

**If any failure occurs**: Immediately revert Phase 4 changes. Phases 1-3 provide significant value even without Phase 4.

## CONCLUSION

Phase 4 is the **HIGHEST RISK** phase. The previous phases (1-3) already provide significant benefits:
- 1,000+ lines extracted from main class
- Better organization and maintainability
- Clear separation of utilities, PDF, and validation logic

**Consider Phase 4 optional** - proceed only if:
1. Phases 1-3 are working perfectly
2. You have time for extensive testing
3. You're prepared to revert if issues occur
4. The complexity/benefit trade-off makes sense