#!/usr/bin/env bun

/**
 * Test Orleans library implementation using Bun
 * Tests both direct ARCA URLs and Orleans catalog URLs
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

// Test URLs for Orleans manuscripts
const testUrls = [
    {
        name: 'Direct ARCA URL',
        url: 'https://arca.irht.cnrs.fr/ark:/63955/md05s7529d1z',
        expectedMinPages: 50
    },
    {
        name: 'Direct manifest URL',
        url: 'https://api.irht.cnrs.fr/ark:/63955/fykkvnm8wkpd/manifest.json',
        expectedMinPages: 100
    },
    {
        name: 'Orleans catalog URL (from Issue #31)',
        url: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380',
        expectedMinPages: 1
    }
];

async function testOrleansManifest() {
    const loader = new SharedManifestLoaders();
    
    // Set up fetch function using native fetch
    loader.fetchWithRetry = async (url: string, options: any = {}) => {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': options.headers?.Accept || 'application/json',
                    ...options.headers
                }
            });
            
            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                text: async () => await response.text(),
                json: async () => await response.json()
            } as any;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };
    
    // Also set fetchUrl for other methods
    (loader as any).fetchUrl = loader.fetchWithRetry;
    
    console.log('='.repeat(60));
    console.log('🧪 TESTING ORLEANS LIBRARY IMPLEMENTATION');
    console.log('='.repeat(60));
    console.log();
    
    let allTestsPassed = true;
    
    for (const test of testUrls) {
        console.log(`\n📋 Test: ${test.name}`);
        console.log(`   URL: ${test.url}`);
        console.log('-'.repeat(60));
        
        try {
            const startTime = Date.now();
            const result = await loader.getOrleansManifest(test.url);
            const duration = Date.now() - startTime;
            
            if (!result || !result.images) {
                console.error('❌ FAILED: No images returned');
                allTestsPassed = false;
                continue;
            }
            
            const pageCount = result.images.length;
            console.log(`✅ SUCCESS: Loaded ${pageCount} pages in ${duration}ms`);
            
            if (result.displayName) {
                console.log(`   Title: ${result.displayName}`);
            }
            
            // Verify minimum page count
            if (pageCount < test.expectedMinPages) {
                console.error(`⚠️  WARNING: Expected at least ${test.expectedMinPages} pages, got ${pageCount}`);
            }
            
            // Show sample image URLs
            if (result.images.length > 0) {
                console.log(`   First page URL: ${result.images[0].url}`);
                if (result.images.length > 1) {
                    console.log(`   Last page URL: ${result.images[result.images.length - 1].url}`);
                }
            }
            
            // Verify URLs are valid IIIF URLs
            const firstUrl = result.images[0].url;
            if (firstUrl.includes('iiif.irht.cnrs.fr')) {
                console.log('   ✅ Valid IRHT IIIF URL format');
            } else {
                console.error('   ⚠️  Unexpected URL format');
            }
            
        } catch (error: any) {
            console.error(`❌ FAILED: ${error.message}`);
            if (error.stack) {
                console.error('   Stack:', error.stack.split('\n').slice(1, 3).join('\n'));
            }
            allTestsPassed = false;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED');
    } else {
        console.log('❌ SOME TESTS FAILED');
    }
    console.log('='.repeat(60));
    
    return allTestsPassed;
}

// Run tests
testOrleansManifest().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});