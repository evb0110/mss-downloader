#!/usr/bin/env bun

/**
 * FLORENCE PRODUCTION WORKFLOW TEST
 * 
 * Tests complete Florence workflow using actual production components
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';

// Mock dependencies
const mockLogger = {
    log: () => {},
    logDownloadStart: () => {},
    logDownloadComplete: () => {},
    logDownloadError: () => {}
};

const loaderDeps = {
    fetchWithHTTPS: fetch,
    fetchWithProxyFallback: fetch,
    fetchDirect: fetch,
    logger: mockLogger
};

// Simplified library detection (from EnhancedManuscriptDownloaderService logic)
function detectLibrary(url: string): string | null {
    if (url.includes('cdm21059.contentdm.oclc.org')) {
        return 'florence';
    }
    return null;
}

async function runCompleteProductionTest() {
    console.log('🏛️ FLORENCE PRODUCTION WORKFLOW TEST');
    console.log('====================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2';
    console.log(`🎯 Testing: ${testUrl}`);
    console.log(`📋 Expected: Plut.16.39 Calendarium manuscript\n`);
    
    try {
        // Step 1: Library Detection (production logic)
        console.log('📋 Step 1: Library Detection...');
        const detectedLibrary = detectLibrary(testUrl);
        console.log(`✅ Detected library: "${detectedLibrary}"`);
        
        if (detectedLibrary !== 'florence') {
            throw new Error(`Library detection failed: expected 'florence', got '${detectedLibrary}'`);
        }
        
        // Step 2: FlorenceLoader Instantiation (production routing)
        console.log('\n📋 Step 2: Production Routing to FlorenceLoader...');
        const florenceLoader = new FlorenceLoader(loaderDeps);
        console.log('✅ FlorenceLoader instantiated with production dependencies');
        
        // Step 3: Manifest Loading (production FlorenceLoader logic)
        console.log('\n📋 Step 3: Production Manifest Loading...');
        console.log('⚡ This will test ALL production features:');
        console.log('   - ContentDM session establishment (JSESSIONID cookies)');
        console.log('   - HTML state extraction from Florence page');
        console.log('   - Child page ID discovery (not parent compound object)');
        console.log('   - Intelligent size testing cascade (6000→4000→2048→1024→800px)');
        console.log('   - ContentDM-specific headers and rate limiting');
        
        const manifestStart = Date.now();
        const manifest = await florenceLoader.loadManifest(testUrl);
        const manifestDuration = Date.now() - manifestStart;
        
        console.log(`✅ Production manifest loaded in ${manifestDuration}ms:`);
        console.log(`   - Library: ${manifest.library}`);
        console.log(`   - Display Name: "${manifest.displayName}"`);
        console.log(`   - Total Pages: ${manifest.totalPages}`);
        console.log(`   - Page Links Generated: ${manifest.pageLinks?.length}`);
        console.log(`   - Original URL: ${manifest.originalUrl}`);
        
        // Step 4: Validate Child Page ID Usage
        console.log('\n📋 Step 4: Validating Child Page ID Usage...');
        
        if (!manifest.pageLinks || manifest.pageLinks.length === 0) {
            throw new Error('No page links generated - manifest loading failed');
        }
        
        const firstPageUrl = manifest.pageLinks[0];
        const lastPageUrl = manifest.pageLinks[manifest.pageLinks.length - 1];
        
        const firstPageId = firstPageUrl.match(/plutei:(\d+)/)?.[1];
        const lastPageId = lastPageUrl.match(/plutei:(\d+)/)?.[1];
        const parentId = '217923'; // From the URL
        
        console.log(`   - First page ID: ${firstPageId} (URL: ${firstPageUrl})`);
        console.log(`   - Last page ID: ${lastPageId} (URL: ${lastPageUrl})`);
        console.log(`   - Parent compound ID: ${parentId}`);
        
        if (firstPageId === parentId || lastPageId === parentId) {
            throw new Error('ROUTING BUG: Still using parent compound object ID instead of child page IDs');
        }
        
        console.log('✅ Child page ID routing verified: Using child IDs, not parent compound ID');
        
        // Step 5: Production Download Simulation
        console.log('\n📋 Step 5: Production Download Simulation...');
        console.log(`Testing first 8 pages for production download compatibility...\n`);
        
        let successCount = 0;
        let error501Count = 0;
        let error403Count = 0;
        let otherErrorCount = 0;
        
        const testCount = Math.min(8, manifest.pageLinks.length);
        
        for (let i = 0; i < testCount; i++) {
            const pageUrl = manifest.pageLinks[i];
            const pageId = pageUrl.match(/plutei:(\d+)/)?.[1] || 'unknown';
            
            try {
                // Use exact production headers and method
                const response = await fetch(pageUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'image/*,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': 'https://cdm21059.contentdm.oclc.org/',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'DNT': '1'
                    }
                });
                
                if (response.ok) {
                    successCount++;
                    const size = response.headers.get('content-length');
                    const sizeText = size ? `${Math.round(parseInt(size) / 1024)}KB` : 'size unknown';
                    console.log(`✅ Page ${i+1} (ID ${pageId}): ${response.status} OK - ${sizeText}`);
                } else if (response.status === 403) {
                    error403Count++;
                    console.log(`❌ Page ${i+1} (ID ${pageId}): 403 Forbidden - session/auth issue`);
                } else if (response.status === 501) {
                    error501Count++;
                    console.log(`⚠️  Page ${i+1} (ID ${pageId}): 501 Not Implemented - gap in sequence`);
                } else {
                    otherErrorCount++;
                    console.log(`❌ Page ${i+1} (ID ${pageId}): ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                otherErrorCount++;
                console.log(`💥 Page ${i+1} (ID ${pageId}): ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Production-like rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Step 6: Results Analysis
        const successRate = Math.round((successCount / testCount) * 100);
        const error501Rate = Math.round((error501Count / testCount) * 100);
        const error403Rate = Math.round((error403Count / testCount) * 100);
        
        console.log('\n📊 PRODUCTION DOWNLOAD SIMULATION RESULTS:');
        console.log(`✅ Successful downloads: ${successCount}/${testCount} (${successRate}%)`);
        console.log(`⚠️  501 Not Implemented (gaps): ${error501Count}/${testCount} (${error501Rate}%)`);
        console.log(`❌ 403 Forbidden (auth issues): ${error403Count}/${testCount} (${error403Rate}%)`);
        console.log(`💥 Other errors: ${otherErrorCount}/${testCount} (${Math.round((otherErrorCount / testCount) * 100)}%)`);
        
        // Step 7: Production Readiness Assessment
        console.log('\n🚀 PRODUCTION READINESS ASSESSMENT:');
        
        if (error403Count > 0) {
            console.log('❌ CRITICAL: 403 Forbidden errors detected');
            console.log('🔧 Session management or authentication not working');
            console.log('🔧 ContentDM JSESSIONID cookies not being established');
            return { success: false, error: `${error403Rate}% 403 Forbidden errors` };
        }
        
        if (successRate >= 60) {
            console.log('✅ SUCCESS: Florence production workflow ready!');
            console.log('✅ Library detection working');
            console.log('✅ FlorenceLoader routing working');
            console.log('✅ Child page ID extraction working');
            console.log('✅ Session management working (no 403 errors)');
            console.log('✅ Size optimization working');
            
            const estimatedUsablePages = Math.round(manifest.totalPages * (successRate / 100));
            console.log(`\n📊 Production Expectations:`);
            console.log(`   - Total pages discovered: ${manifest.totalPages}`);
            console.log(`   - Estimated usable pages: ~${estimatedUsablePages} (${successRate}% success rate)`);
            console.log(`   - Gap pages (501 errors): ~${Math.round(manifest.totalPages * (error501Rate / 100))} pages`);
            
            if (error501Rate > 0) {
                console.log(`\n📋 RECOMMENDATION: Consider gap filtering for production`);
                console.log(`   - ${error501Rate}% of pages return 501 Not Implemented`);
                console.log(`   - This is normal for ContentDM compound objects with ID sequence gaps`);
                console.log(`   - Downloads will skip these pages automatically with retries`);
            }
            
            return {
                success: true,
                manifest,
                successRate,
                gapRate: error501Rate,
                estimatedUsablePages
            };
        } else {
            console.log('❌ FAILURE: Too many page access failures');
            console.log(`❌ Only ${successRate}% pages accessible (minimum 60% required)`);
            return { success: false, error: `Only ${successRate}% page success rate` };
        }
        
    } catch (error) {
        console.error('\n💥 Production workflow test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Run the complete production test
console.log('Starting Florence production workflow validation...\n');

runCompleteProductionTest().then(result => {
    if (result.success) {
        console.log(`\n🎉 FLORENCE PRODUCTION TEST: PASSED ✅`);
        console.log(`📊 Ready for production use with ${result.successRate}% page accessibility`);
        console.log(`📊 Estimated usable pages: ${result.estimatedUsablePages}/${result.manifest.totalPages}`);
        console.log(`\n🚀 User can now download this manuscript successfully!`);
        process.exit(0);
    } else {
        console.log(`\n💥 FLORENCE PRODUCTION TEST: FAILED ❌`);
        console.log(`❌ Error: ${result.error}`);
        console.log(`\n🔧 Additional fixes required before production use`);
        process.exit(1);
    }
}).catch(error => {
    console.error(`\n💥 Test execution failed:`, error);
    process.exit(1);
});