# Routing Methodology - Detailed Implementation Guide

## Routing Debugging Methodology

**BEFORE making ANY routing changes, ALWAYS:**

### 🧪 Diagnosis Phase
```bash
# 1. Identify current routing path
echo "Testing: https://example.com/manuscript" | node -e "
const detector = require('./src/shared/SharedLibraryDetector.ts');
const input = require('fs').readFileSync(0, 'utf8').trim();
console.log('Detected:', detector.detectLibrary(input));
"

# 2. Check if loader exists
ls src/main/services/library-loaders/*Loader.ts | grep -i library_name

# 3. Check SharedManifestLoaders method
grep -n "getLibraryManifest\|library_name" src/shared/SharedManifestLoaders.ts

# 4. Verify registration
grep -rn "library_name" src/main/services/library-loaders/ | grep "register\|export"
```

### 🎯 Testing Phase (MANDATORY before committing)
```bash
# Test individual components
bun test-routing-component.ts  # Create for specific library

# Test URL detection
bun test-url-detection.ts      # Verify detection returns expected ID

# Test loader registration  
bun test-loader-registry.ts    # Verify loader is properly registered

# Test full routing path
bun test-full-routing.ts       # End-to-end routing validation
```

### 📝 Documentation Phase
```typescript
// ALWAYS document routing decisions in code
case 'library_name':
    // ROUTING: library_name → LibraryLoader (registered as 'library_name')
    // WHY: Individual loader has advanced features vs SharedManifest basic implementation
    // TESTED: 2024-XX-XX with manuscripts: MS123, MS456  
    manifest = await this.loadLibraryManifest('library_name', originalUrl);
    break;
```

## Routing Architecture Changes - Mandatory Process

**NEVER make routing changes without following this process:**

### 📋 PRE-CHANGE CHECKLIST
```bash
# 1. Document current state
git status && git diff > /tmp/pre-routing-state.diff

# 2. Create test URLs file  
echo "# Test URLs for library_name routing change" > .devkit/testing/routing-test-urls.txt
echo "https://example.com/manuscript1" >> .devkit/testing/routing-test-urls.txt
echo "https://example.com/manuscript2" >> .devkit/testing/routing-test-urls.txt

# 3. Test current behavior
for url in $(cat .devkit/testing/routing-test-urls.txt | grep -v '#'); do
    echo "Testing: $url"
    bun test-current-routing.ts "$url"
done

# 4. Backup current routing logic
cp src/main/services/EnhancedManuscriptDownloaderService.ts \
   .devkit/backup/EnhancedManuscriptDownloaderService.pre-change.ts
```

### ✅ POST-CHANGE VALIDATION
```bash
# 1. Build test (MUST pass)
npm run build || exit 1

# 2. Test affected library URLs
for url in $(cat .devkit/testing/routing-test-urls.txt | grep -v '#'); do
    echo "POST-CHANGE Testing: $url"
    bun test-new-routing.ts "$url" || exit 1
done

# 3. Test Rome/ICCU/Monte-Cassino triad (MANDATORY)
bun test-rome-triad.ts || exit 1

# 4. Git commit with detailed message
git add -A
git commit -m "🔧 ROUTING: library_name → NewImplementation

CHANGE: Detection 'library_name' now routes to NewLoader instead of SharedManifest
WHY: NewLoader has advanced features vs basic SharedManifest implementation  
TESTED: manuscript1, manuscript2 - both load successfully
VALIDATED: Rome/ICCU/Monte-Cassino triad unaffected

Files modified:
- EnhancedManuscriptDownloaderService.ts (routing case)
- Optional: SharedLibraryDetector.ts (if detection changed)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 🔒 ROLLBACK PROCEDURE (If things break)
```bash
# 1. Immediate rollback
git checkout HEAD~1 -- src/main/services/EnhancedManuscriptDownloaderService.ts

# 2. Test rollback works  
npm run build && bun test-rome-triad.ts

# 3. Analyze what went wrong
git diff HEAD~1 HEAD src/main/services/EnhancedManuscriptDownloaderService.ts

# 4. Create detailed issue analysis
echo "ROUTING ROLLBACK ANALYSIS" > .devkit/analysis/routing-failure-$(date +%Y%m%d).md
echo "What we tried to change: ..." >> .devkit/analysis/routing-failure-$(date +%Y%m%d).md
```

## Rome/ICCU/Monte-Cassino Collision Prevention

**NEVER change routing for these libraries without testing ALL THREE:**
- Rome: `http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062`
- ICCU: `https://manus.iccu.sbn.it/cnmd/0000313047`  
- Monte-Cassino: Direct OMNES IIIF manuscripts

**These three libraries have complex interdependencies that can create cascading failures.**

## Emergency Test URLs (ALWAYS test these after routing changes)

```bash
# Rome library (genuine Rome manuscripts)
http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1

# ICCU catalog (routes to Monte Cassino)  
https://manus.iccu.sbn.it/cnmd/0000313047

# Monte Cassino direct IIIF
# (Test with actual OMNES URLs when server accessible)

# Saint-Omer (routing identifier test)
https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/

# Toronto (individual loader test)  
https://collections.library.utoronto.ca/view/fisher2:F6521

# HHU (IIIF pattern support test)
https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
```

## Routing Validation Checklist

- [ ] Detection output matches routing case string exactly
- [ ] Routing case matches loader registration key exactly  
- [ ] Loader exists and is properly registered
- [ ] Test with real manuscript URLs (minimum 2 different manuscripts)
- [ ] Document routing decision with reasoning
- [ ] Verify no regressions in related libraries (especially Rome/ICCU/Monte-Cassino)