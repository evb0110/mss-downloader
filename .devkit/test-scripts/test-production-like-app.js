#!/usr/bin/env node

/**
 * Test production code exactly like the app does
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Test cases from GitHub issues
const TEST_CASES = {
    issue_4: {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        title: 'морган',
        expectedLibrary: 'morgan'
    },
    issue_5: {
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        title: 'Флоренция',
        expectedLibrary: 'florence'
    },
    issue_6: {
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        title: 'Бордо',
        expectedLibrary: 'bordeaux'
    },
    issue_10: {
        url: 'https://www.e-manuscripta.ch/bau/content/zoom/5157616',
        title: 'Цюрих',
        expectedLibrary: 'e_manuscripta'
    },
    issue_11: {
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        title: 'BNE',
        expectedLibrary: 'bne'
    }
};

// Mimic the detectLibrary function from the app
function detectLibrary(url) {
    if (url.includes('themorgan.org')) return 'morgan';
    if (url.includes('contentdm.oclc.org') && url.includes('plutei')) return 'florence';
    if (url.includes('selene.bordeaux.fr')) return 'bordeaux';
    if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
    if (url.includes('bdh-rd.bne.es')) return 'bne';
    return null;
}

async function testIssue(issueId, config) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${issueId}: ${config.title}`);
    console.log(`URL: ${config.url}`);
    
    const library = detectLibrary(config.url);
    console.log(`Detected library: ${library}`);
    
    if (!library) {
        console.log('❌ FAILED: Library not detected');
        return { success: false, error: 'Library not detected' };
    }
    
    const loader = new SharedManifestLoaders();
    
    try {
        // Use the exact method the app uses
        const manifest = await loader.getManifestForLibrary(library, config.url);
        
        // Handle both 'pages' and 'images' formats (SharedManifestLoaders returns 'images')
        const pages = manifest.pages || manifest.images;
        const title = manifest.title || manifest.displayName;
        
        if (manifest && pages && pages.length > 0) {
            console.log(`✅ SUCCESS: Loaded ${pages.length} pages`);
            console.log(`   Title: ${title || 'Unknown'}`);
            const firstPageUrl = typeof pages[0] === 'string' ? pages[0] : pages[0].url;
            console.log(`   First page: ${firstPageUrl.substring(0, 100)}...`);
            
            // Validate pages are different
            if (pages.length > 1) {
                const firstPage = typeof pages[0] === 'string' ? pages[0] : pages[0].url;
                const secondPage = typeof pages[1] === 'string' ? pages[1] : pages[1].url;
                if (firstPage === secondPage) {
                    console.log('⚠️  WARNING: First two pages have identical URLs');
                }
            }
            
            return { 
                success: true, 
                manifest: {
                    title: title,
                    pageCount: pages.length,
                    library: library
                }
            };
        } else {
            console.log(`⚠️ PARTIAL: Manifest loaded but no pages found`);
            return { success: false, error: 'No pages in manifest' };
        }
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        
        // Show where it failed for debugging
        if (error.stack) {
            const match = error.stack.match(/SharedManifestLoaders\.js:(\d+)/);
            if (match) {
                console.log(`   Failed at line ${match[1]} in SharedManifestLoaders.js`);
            }
        }
        return { success: false, error: error.message };
    }
}

// Run all tests
(async () => {
    console.log('TESTING ALL GITHUB ISSUES WITH PRODUCTION CODE');
    console.log('='.repeat(60));
    
    const results = {};
    
    for (const [issueId, config] of Object.entries(TEST_CASES)) {
        results[issueId] = await testIssue(issueId, config);
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    let working = 0;
    let needsFix = 0;
    
    for (const [issueId, result] of Object.entries(results)) {
        const config = TEST_CASES[issueId];
        if (result.success) {
            console.log(`✅ ${issueId} (${config.title}): WORKING - ${result.manifest.pageCount} pages`);
            working++;
        } else {
            console.log(`❌ ${issueId} (${config.title}): NEEDS FIX - ${result.error}`);
            needsFix++;
        }
    }
    
    console.log(`\nTotal: ${working} working, ${needsFix} need fixes`);
    
    if (needsFix === 0) {
        console.log('\n🎉 ALL ISSUES RESOLVED!');
    }
})();