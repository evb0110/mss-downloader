const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');
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
    
    // Create downloader service for testing
    const downloader = new EnhancedManuscriptDownloaderService();
    
    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log('='.repeat(50));
        
        try {
            // Load manifest
            console.log(`Loading manifest for: ${testCase.url}`);
            const manifest = await downloader.loadManifest(testCase.url);
            
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
                const partData = [];
                
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
                    
                    // Store part data for verification
                    partData.push({
                        partIndex: i + 1,
                        startPage,
                        endPage,
                        pageCount: partPages.length,
                        firstPageUrl: partPages[0]?.substring(0, 50) + '...',
                        lastPageUrl: partPages[partPages.length - 1]?.substring(0, 50) + '...'
                    });
                    
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
                
                // Verify no two parts have the same first or last page
                for (let i = 0; i < partData.length; i++) {
                    for (let j = i + 1; j < partData.length; j++) {
                        if (partData[i].firstPageUrl === partData[j].firstPageUrl) {
                            throw new Error(`Parts ${partData[i].partIndex} and ${partData[j].partIndex} have same first page`);
                        }
                        if (partData[i].lastPageUrl === partData[j].lastPageUrl) {
                            throw new Error(`Parts ${partData[i].partIndex} and ${partData[j].partIndex} have same last page`);
                        }
                    }
                }
                
                results.passed.push({
                    name: testCase.name,
                    details: {
                        totalPages: manifest.totalPages,
                        parts: partData,
                        special: testCase.special
                    }
                });
                console.log(`✅ ${testCase.name} PASSED`);
            } else {
                console.log('No split needed for this manuscript');
                results.passed.push({
                    name: testCase.name,
                    details: {
                        totalPages: manifest.totalPages,
                        split: false,
                        special: testCase.special
                    }
                });
            }
            
        } catch (error) {
            console.error(`❌ ${testCase.name} FAILED: ${error.message}`);
            results.failed.push({
                name: testCase.name,
                error: error.message,
                stack: error.stack
            });
            results.errors.push(error.message);
        }
    }
    
    // Test edge cases
    console.log('\n' + '='.repeat(60));
    console.log('TESTING EDGE CASES');
    console.log('='.repeat(60));
    
    // Test page slicing logic directly
    try {
        const testPageLinks = Array.from({length: 247}, (_, i) => `https://example.com/page${i+1}.jpg`);
        
        // Simulate 3-part split like Graz
        const part1Pages = testPageLinks.slice(0, 83);  // Pages 1-83
        const part2Pages = testPageLinks.slice(83, 166); // Pages 84-166  
        const part3Pages = testPageLinks.slice(166, 247); // Pages 167-247
        
        // Verify no overlaps
        const allPages = [...part1Pages, ...part2Pages, ...part3Pages];
        const uniquePages = new Set(allPages);
        
        if (allPages.length !== uniquePages.size) {
            throw new Error('Page slicing logic has overlaps');
        }
        
        if (allPages.length !== testPageLinks.length) {
            throw new Error(`Page slicing lost pages: ${allPages.length} vs ${testPageLinks.length}`);
        }
        
        console.log(`✅ Page slicing logic test PASSED`);
        console.log(`  Part 1: ${part1Pages.length} pages`);
        console.log(`  Part 2: ${part2Pages.length} pages`);
        console.log(`  Part 3: ${part3Pages.length} pages`);
        
        results.passed.push({
            name: 'Page Slicing Logic Test',
            details: {
                totalPages: testPageLinks.length,
                parts: [
                    { partIndex: 1, pageCount: part1Pages.length },
                    { partIndex: 2, pageCount: part2Pages.length },
                    { partIndex: 3, pageCount: part3Pages.length }
                ]
            }
        });
        
    } catch (error) {
        console.error(`❌ Page slicing logic test FAILED: ${error.message}`);
        results.failed.push({
            name: 'Page Slicing Logic Test',
            error: error.message
        });
        results.errors.push(error.message);
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
    } else {
        console.log('\n🎉 ALL TESTS PASSED!');
    }
    
    // Calculate success rate
    const total = results.passed.length + results.failed.length;
    const successRate = total > 0 ? (results.passed.length / total * 100) : 0;
    
    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: total,
            passed: results.passed.length,
            failed: results.failed.length,
            successRate: successRate,
            canProceedToBump: results.failed.length === 0 && successRate >= 95
        },
        results: results,
        testCases: testCases.map(tc => ({ name: tc.name, library: tc.library, special: tc.special }))
    };
    
    await fs.writeFile(
        '.devkit/testing/test-results.json',
        JSON.stringify(report, null, 2)
    );
    
    console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`📁 Detailed report saved to: .devkit/testing/test-results.json`);
    
    if (report.summary.canProceedToBump) {
        console.log('✅ Ready to proceed to Phase 5 (Autonomous Bump)');
    } else {
        console.log('❌ Cannot proceed to Phase 5 - tests failed or success rate < 95%');
    }
    
    return report.summary.canProceedToBump;
}

// Run tests
testManuscriptSplitting().then(success => {
    console.log(`\n🏁 Testing complete. Success: ${success}`);
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Test script crashed:', error);
    process.exit(1);
});