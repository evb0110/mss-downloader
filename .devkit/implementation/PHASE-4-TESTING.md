# Phase 4: Comprehensive Testing Protocol

## Objective
Validate that the fix works across all 42+ supported libraries without breaking existing functionality.

## Test Categories

### Category A: High-Risk Libraries (Special Processing)

#### A1. Bordeaux (DirectTileProcessor)
```javascript
const testUrl = 'https://www.burdigalaensia.fr/notice?id=36';
// Expected: Tiles properly stitched, multiple parts if >300MB
// Validate: tileConfig preserved, correct page ranges
```

#### A2. Morgan (.zif Processing)
```javascript
const testUrl = 'https://microsite.themorlibrary.org/manuscripts/manuscript/130589';
// Expected: .zif files downloaded and processed
// Validate: TileEngineService handles correctly
```

#### A3. E-manuscripta (Block Discovery)
```javascript
const testUrl = 'https://e-manuscripta.ch/bau/content/titleinfo/2271618';
// Expected: Dynamic page discovery works
// Validate: All blocks processed, correct ranges
```

### Category B: Standard IIIF Libraries

#### B1. Graz University
```javascript
const testUrl = 'https://unipub.uni-graz.at/ubgarchiv/content/titleinfo/7729373';
// Expected: 247 pages split into 3 parts
// Validate: Each part has different pages
```

#### B2. Vatican Library
```javascript
const testUrl = 'https://digi.vatlib.it/view/MSS_Vat.lat.3225';
// Expected: Proper IIIF handling
// Validate: No duplicate pages in parts
```

#### B3. Gallica (BnF)
```javascript
const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8539703s';
// Expected: .highres images downloaded
// Validate: Correct page sequences
```

### Category C: Edge Cases

#### C1. Small Manuscript (No Split)
```javascript
// Test with <50 pages manuscript
// Expected: No splitting occurs
// Validate: Downloads as single file
```

#### C2. Exact Threshold (300MB)
```javascript
// Test with manuscript exactly at split threshold
// Expected: Proper split decision
// Validate: Either split or not, but consistent
```

#### C3. Manual Page Range
```javascript
// Test with user-specified page range
// Expected: Only selected pages downloaded
// Validate: Range respected in parts
```

## Automated Test Script

```javascript
const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const { EnhancedDownloadQueue } = require('./src/main/services/EnhancedDownloadQueue.js');
const fs = require('fs').promises;
const path = require('path');

async function testManuscriptSplitting() {
    const results = {
        passed: [],
        failed: [],
        errors: []
    };
    
    const testCases = [
        {
            name: 'Graz Split Test',
            url: 'https://unipub.uni-graz.at/ubgarchiv/content/titleinfo/7729373',
            expectedParts: 3,
            library: 'graz'
        },
        {
            name: 'Vatican Split Test',
            url: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
            expectedParts: 2,
            library: 'vatican'
        },
        {
            name: 'Bordeaux Tile Test',
            url: 'https://www.burdigalaensia.fr/notice?id=36',
            expectedParts: 1, // May vary
            library: 'bordeaux',
            special: 'tiles'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log('='.repeat(50));
        
        try {
            // Load manifest
            const loaders = new SharedManifestLoaders();
            const manifest = await loaders.loadManifest(testCase.url);
            
            console.log(`Loaded: ${manifest.totalPages} pages`);
            
            // Simulate splitting
            const threshold = 300; // MB
            const estimatedSizeMB = manifest.totalPages * 0.5; // Estimate 0.5MB per page
            const shouldSplit = estimatedSizeMB > threshold;
            
            if (shouldSplit) {
                const numberOfParts = Math.ceil(estimatedSizeMB / threshold);
                const pagesPerPart = Math.ceil(manifest.totalPages / numberOfParts);
                
                console.log(`Will split into ${numberOfParts} parts`);
                
                // Validate each part
                const seenPages = new Set();
                
                for (let i = 0; i < numberOfParts; i++) {
                    const startPage = i * pagesPerPart + 1;
                    const endPage = Math.min((i + 1) * pagesPerPart, manifest.totalPages);
                    const partPages = manifest.pageLinks.slice(startPage - 1, endPage);
                    
                    console.log(`Part ${i + 1}: pages ${startPage}-${endPage} (${partPages.length} pages)`);
                    
                    // Check for duplicates
                    for (const pageUrl of partPages) {
                        if (seenPages.has(pageUrl)) {
                            throw new Error(`Duplicate page detected: ${pageUrl}`);
                        }
                        seenPages.add(pageUrl);
                    }
                    
                    // Verify first and last page
                    if (partPages.length > 0) {
                        console.log(`  First: ${partPages[0].substring(0, 50)}...`);
                        console.log(`  Last: ${partPages[partPages.length - 1].substring(0, 50)}...`);
                    }
                }
                
                // Verify all pages covered
                if (seenPages.size !== manifest.totalPages) {
                    throw new Error(`Page count mismatch: ${seenPages.size} vs ${manifest.totalPages}`);
                }
                
                results.passed.push(testCase.name);
                console.log(`✅ ${testCase.name} PASSED`);
            } else {
                console.log('No split needed for this manuscript');
                results.passed.push(testCase.name);
            }
            
        } catch (error) {
            console.error(`❌ ${testCase.name} FAILED: ${error.message}`);
            results.failed.push({
                name: testCase.name,
                error: error.message
            });
        }
    }
    
    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log('\nFailed Tests:');
        for (const failure of results.failed) {
            console.log(`  - ${failure.name}: ${failure.error}`);
        }
    }
    
    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: testCases.length,
            passed: results.passed.length,
            failed: results.failed.length
        },
        results: results
    };
    
    await fs.writeFile(
        '.devkit/testing/test-results.json',
        JSON.stringify(report, null, 2)
    );
    
    return results.failed.length === 0;
}

// Run tests
testManuscriptSplitting().then(success => {
    process.exit(success ? 0 : 1);
});
```

## Validation Criteria

### MUST PASS (Critical):
1. No duplicate pages across parts
2. All pages accounted for (no missing pages)
3. Correct page sequence in each part
4. Special processors continue working

### SHOULD PASS (Important):
1. Progress reporting accurate
2. File naming correct
3. Memory usage reasonable
4. Download speed not degraded

### NICE TO HAVE:
1. Improved error messages
2. Better logging
3. Performance metrics

## Testing Command
```bash
node .devkit/testing/comprehensive-test.js
```

## Success Criteria
- All Category A tests pass (high-risk libraries)
- At least 90% of Category B tests pass
- No regression in existing functionality
- Memory usage stable
- No crashes or hangs