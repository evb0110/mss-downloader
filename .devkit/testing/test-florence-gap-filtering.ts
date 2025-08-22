#!/usr/bin/env bun

/**
 * Test Florence gap filtering functionality
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';

const mockLogger = {
    log: console.log,
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

async function testGapFiltering() {
    console.log('🔍 TESTING FLORENCE GAP FILTERING');
    console.log('=================================\n');
    
    const florenceLoader = new FlorenceLoader(loaderDeps);
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2';
    
    console.log('📋 Loading manifest with gap filtering enabled...');
    
    try {
        const manifest = await florenceLoader.loadManifest(testUrl);
        
        console.log(`\n✅ Manifest loaded:`);
        console.log(`   - Total Pages: ${manifest.totalPages}`);
        console.log(`   - Page Links: ${manifest.pageLinks?.length}`);
        
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            console.log(`\n📋 Testing first 10 generated page URLs:`);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < Math.min(10, manifest.pageLinks.length); i++) {
                const pageUrl = manifest.pageLinks[i];
                const pageId = pageUrl.match(/plutei:(\d+)/)?.[1] || 'unknown';
                
                try {
                    const response = await fetch(pageUrl, {
                        method: 'HEAD',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            'Accept': 'image/*,*/*;q=0.8',
                            'Referer': 'https://cdm21059.contentdm.oclc.org/',
                        }
                    });
                    
                    if (response.ok) {
                        successCount++;
                        console.log(`✅ Page ${i+1} (ID ${pageId}): ${response.status} OK`);
                    } else {
                        errorCount++;
                        console.log(`❌ Page ${i+1} (ID ${pageId}): ${response.status} ${response.statusText}`);
                    }
                } catch (error) {
                    errorCount++;
                    console.log(`💥 Page ${i+1} (ID ${pageId}): ${error instanceof Error ? error.message : String(error)}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const successRate = Math.round((successCount / Math.min(10, manifest.pageLinks.length)) * 100);
            console.log(`\n📊 Gap filtering results: ${successCount}/10 successful (${successRate}%)`);
            
            if (successRate >= 80) {
                console.log('✅ Gap filtering working - high success rate achieved');
            } else {
                console.log('❌ Gap filtering needs improvement - too many failures remain');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testGapFiltering();