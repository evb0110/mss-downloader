#!/usr/bin/env bun

/**
 * Test Florence page 2 accessibility to verify if it's actually missing
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';

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

async function testPage2Access() {
    console.log('🔍 TESTING FLORENCE PAGE 2 ACCESS');
    console.log('==================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`Target URL: ${testUrl}\n`);
    
    try {
        // Load the manuscript to get all page URLs
        console.log('📋 Loading manuscript to get all page URLs...');
        const florenceLoader = new FlorenceLoader(loaderDeps);
        const manifest = await florenceLoader.loadManifest(testUrl);
        
        console.log(`✅ Manifest loaded:`);
        console.log(`   - Total Pages: ${manifest.totalPages}`);
        console.log(`   - Display Name: ${manifest.displayName}\n`);
        
        if (manifest.pageLinks && manifest.pageLinks.length >= 2) {
            console.log('📋 Page URLs from manifest:');
            
            // Show first 5 pages
            for (let i = 0; i < Math.min(5, manifest.pageLinks.length); i++) {
                const pageUrl = manifest.pageLinks[i];
                const pageId = pageUrl.match(/plutei:(\d+)/)?.[1] || 'unknown';
                console.log(`   Page ${i+1}: ID ${pageId}`);
                console.log(`   URL: ${pageUrl}`);
            }
            
            console.log('\n📋 Testing Page 2 accessibility specifically...');
            const page2Url = manifest.pageLinks[1]; // Page 2 (0-indexed)
            const page2Id = page2Url.match(/plutei:(\d+)/)?.[1] || 'unknown';
            
            console.log(`Page 2 ID: ${page2Id}`);
            console.log(`Page 2 URL: ${page2Url}\n`);
            
            // Test page 2 accessibility
            try {
                const response = await fetch(page2Url, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'image/*,*/*;q=0.8',
                        'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    }
                });
                
                if (response.ok) {
                    const size = response.headers.get('content-length');
                    console.log(`✅ PAGE 2 IS ACCESSIBLE!`);
                    console.log(`   Status: ${response.status} ${response.statusText}`);
                    console.log(`   Size: ${size ? Math.round(parseInt(size) / 1024) + 'KB' : 'unknown'}`);
                    console.log(`\n🚨 This contradicts the claim that page 2 is missing!`);
                } else {
                    console.log(`❌ Page 2 NOT accessible:`);
                    console.log(`   Status: ${response.status} ${response.statusText}`);
                    console.log(`   This confirms page 2 is genuinely inaccessible`);
                }
            } catch (error) {
                console.log(`💥 Page 2 test failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Also test the direct page 2 navigation URL
            console.log('\n📋 Testing direct page 2 navigation...');
            const directPage2Url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
            console.log(`Direct URL: ${directPage2Url}`);
            
            // This should show us what ContentDM considers "page 2"
            console.log('\n📋 If page 2 exists, the user should be able to navigate to it directly.');
            console.log('The manifest extraction logic should have found the correct child page ID.');
            
        } else {
            console.log('❌ No page links found in manifest');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testPage2Access();