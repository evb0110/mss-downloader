const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');

async function ultraValidation() {
    console.log('🔬 ULTRA-VALIDATION PROTOCOL FOR ISSUE #5 FIX');
    console.log('==============================================\n');
    
    const loader = new SharedManifestLoaders();
    const results = {
        florence: [],
        otherLibraries: [],
        summary: {
            florenceTests: 0,
            florenceSuccess: 0,
            otherTests: 0,
            otherSuccess: 0
        }
    };
    
    // Test 1: Multiple Florence URLs
    console.log('PHASE 1: Testing Multiple Florence URLs');
    console.log('----------------------------------------');
    
    const florenceTests = [
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            name: 'User reported URL (Issue #5)',
            expectedPages: 20 // Expecting at least 20 pages
        },
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317400/',
            name: 'Different manuscript',
            expectedPages: 1 // At least 1 page
        },
        {
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/318000/',
            name: 'Higher ID manuscript',
            expectedPages: 1
        }
    ];
    
    for (const test of florenceTests) {
        console.log(`\nTesting: ${test.name}`);
        console.log(`URL: ${test.url}`);
        results.summary.florenceTests++;
        
        try {
            const start = Date.now();
            const result = await loader.getFlorenceManifest(test.url);
            const duration = Date.now() - start;
            
            const pageCount = result.images ? result.images.length : 0;
            const success = pageCount >= test.expectedPages;
            
            console.log(`  ✅ Success: ${pageCount} pages found (expected ≥${test.expectedPages})`);
            console.log(`  ⏱️  Time: ${duration}ms`);
            
            if (success) results.summary.florenceSuccess++;
            
            results.florence.push({
                url: test.url,
                name: test.name,
                success,
                pageCount,
                duration,
                expectedPages: test.expectedPages
            });
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            results.florence.push({
                url: test.url,
                name: test.name,
                success: false,
                error: error.message
            });
        }
    }
    
    // Test 2: Regression testing for other libraries
    console.log('\n\nPHASE 2: Regression Testing Other Libraries');
    console.log('--------------------------------------------');
    
    const otherLibraryTests = [
        {
            url: 'https://www.themorgan.org/collection/medici-archives/174871',
            library: 'morgan',
            name: 'Morgan Library'
        },
        {
            url: 'https://digital.bodleian.ox.ac.uk/objects/60834383-7146-41ab-bfe1-48ee97bc04be/',
            library: 'bodleian',
            name: 'Bodleian Library'
        },
        {
            url: 'https://digi.vatlib.it/view/MSS_Vat.gr.1',
            library: 'vatican',
            name: 'Vatican Library'
        }
    ];
    
    for (const test of otherLibraryTests) {
        console.log(`\nTesting: ${test.name}`);
        console.log(`URL: ${test.url}`);
        results.summary.otherTests++;
        
        try {
            const start = Date.now();
            const result = await loader.getManifestForLibrary(test.library, test.url);
            const duration = Date.now() - start;
            
            const pageCount = result.images ? result.images.length : 0;
            const success = pageCount > 0;
            
            if (success) {
                console.log(`  ✅ Success: ${pageCount} pages found`);
                console.log(`  ⏱️  Time: ${duration}ms`);
                results.summary.otherSuccess++;
            } else {
                console.log(`  ❌ Failed: No pages found`);
            }
            
            results.otherLibraries.push({
                url: test.url,
                name: test.name,
                library: test.library,
                success,
                pageCount,
                duration
            });
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            results.otherLibraries.push({
                url: test.url,
                name: test.name,
                library: test.library,
                success: false,
                error: error.message
            });
        }
    }
    
    // Generate validation report
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ULTRA-VALIDATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('FLORENCE LIBRARY TESTS:');
    console.log(`  Total: ${results.summary.florenceTests}`);
    console.log(`  Success: ${results.summary.florenceSuccess}/${results.summary.florenceTests}`);
    console.log(`  Success Rate: ${(results.summary.florenceSuccess/results.summary.florenceTests * 100).toFixed(0)}%`);
    
    console.log('\nOTHER LIBRARIES (Regression):');
    console.log(`  Total: ${results.summary.otherTests}`);
    console.log(`  Success: ${results.summary.otherSuccess}/${results.summary.otherTests}`);
    console.log(`  Success Rate: ${(results.summary.otherSuccess/results.summary.otherTests * 100).toFixed(0)}%`);
    
    // Performance metrics
    const florenceDurations = results.florence.filter(r => r.duration).map(r => r.duration);
    if (florenceDurations.length > 0) {
        const avgDuration = florenceDurations.reduce((a, b) => a + b, 0) / florenceDurations.length;
        console.log(`\nFLORENCE PERFORMANCE:`);
        console.log(`  Average time: ${avgDuration.toFixed(0)}ms`);
        console.log(`  Max time: ${Math.max(...florenceDurations)}ms`);
    }
    
    // Overall verdict
    const allFlorenceSuccess = results.summary.florenceSuccess === results.summary.florenceTests;
    const allOthersSuccess = results.summary.otherSuccess === results.summary.otherTests;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allFlorenceSuccess && allOthersSuccess) {
        console.log('✅ VALIDATION PASSED: All tests successful!');
        console.log('🎯 Issue #5 is RESOLVED');
        console.log('🚀 Ready for version bump');
    } else {
        console.log('⚠️  VALIDATION PARTIAL:');
        if (!allFlorenceSuccess) {
            console.log('  - Some Florence tests failed');
        }
        if (!allOthersSuccess) {
            console.log('  - Some regression tests failed');
        }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Save detailed report
    const reportPath = '.devkit/ultra-priority/validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    return allFlorenceSuccess && allOthersSuccess;
}

ultraValidation().then(success => {
    if (success) {
        console.log('\n🎉 ULTRA-VALIDATION COMPLETE - PROCEEDING TO VERSION BUMP');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed - review needed');
        process.exit(1);
    }
}).catch(error => {
    console.error('\n❌ Validation error:', error);
    process.exit(1);
});