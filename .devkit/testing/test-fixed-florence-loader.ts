#!/usr/bin/env bun

/**
 * Test the fixed FlorenceLoader to verify it now uses ContentDM native API URLs
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';

const mockLogger = {
    log: (entry: any) => console.log(`[${entry.level?.toUpperCase()}] ${entry.message}`),
    logDownloadStart: () => {},
    logDownloadComplete: () => {},
    logDownloadError: (library: string, url: string, error: Error) => {
        console.log(`[ERROR] ${library}: ${error.message}`);
    }
};

const loaderDeps = {
    fetchWithHTTPS: fetch,
    fetchWithProxyFallback: fetch,
    fetchDirect: fetch,
    logger: mockLogger
};

async function testFixedLoader() {
    console.log('🔍 TESTING FIXED FLORENCE LOADER');
    console.log('================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`Target URL: ${testUrl}\n`);
    
    try {
        const florenceLoader = new FlorenceLoader(loaderDeps);
        
        console.log('📋 Loading manifest with fixed loader...');
        const startTime = Date.now();
        
        const manifest = await florenceLoader.loadManifest(testUrl);
        
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ MANIFEST LOADED SUCCESSFULLY in ${duration}ms`);
        console.log(`   Total Pages: ${manifest.totalPages}`);
        console.log(`   Display Name: ${manifest.displayName}`);
        console.log(`   Library: ${manifest.library}\n`);
        
        // Show first few page URLs to verify they use ContentDM native API
        console.log('📋 SAMPLE PAGE URLs (first 3):');
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const url = manifest.pageLinks[i];
            console.log(`   Page ${i+1}: ${url}`);
            
            // Verify this is native API format, not IIIF
            if (url.includes('/digital/api/singleitem/image/')) {
                console.log(`   ✅ Correct: Uses ContentDM native API`);
            } else if (url.includes('/iiif/2/')) {
                console.log(`   ❌ WRONG: Still uses IIIF (failed to fix)`);
            } else {
                console.log(`   ❓ Unknown URL format`);
            }
        }
        
        // Test accessibility of first page URL
        console.log('\n📋 Testing first page URL accessibility...');
        const firstUrl = manifest.pageLinks[0];
        if (firstUrl) {
            const response = await fetch(firstUrl, { method: 'HEAD' });
            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                console.log(`   ✅ SUCCESS: Page URL is accessible!`);
            } else {
                console.log(`   ❌ FAILED: Page URL not accessible`);
            }
        }
        
    } catch (error) {
        console.error('❌ LOADER TEST FAILED:', error);
    }
}

testFixedLoader();