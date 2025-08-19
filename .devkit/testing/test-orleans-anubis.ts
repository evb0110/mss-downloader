#!/usr/bin/env bun

/**
 * Test Orleans library with Anubis anti-bot protection
 * Tests the failing URL that requires solving proof-of-work challenge
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

// The failing URL from the user's report
const FAILING_URL = 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380';

async function testOrleansWithAnubis() {
    console.log('='.repeat(60));
    console.log('🔐 TESTING ORLEANS WITH ANUBIS ANTI-BOT PROTECTION');
    console.log('='.repeat(60));
    console.log();
    
    const loader = new SharedManifestLoaders();
    
    // Set up fetch function using native fetch
    loader.fetchWithRetry = async (url: string, options: any = {}) => {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': options.headers?.Accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    ...options.headers
                }
            });
            
            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
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
    
    console.log(`📋 Testing URL: ${FAILING_URL}`);
    console.log('-'.repeat(60));
    
    try {
        const startTime = Date.now();
        
        // This should now handle the Anubis challenge automatically
        const result = await loader.getOrleansManifest(FAILING_URL);
        
        const duration = Date.now() - startTime;
        
        if (!result || !result.images) {
            console.error('❌ FAILED: No images returned');
            return false;
        }
        
        const pageCount = result.images.length;
        console.log(`✅ SUCCESS: Loaded ${pageCount} pages in ${duration}ms`);
        
        if (result.displayName) {
            console.log(`   Title: ${result.displayName}`);
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
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ ANUBIS CHALLENGE SUCCESSFULLY BYPASSED');
        console.log('   Orleans library now works with anti-bot protected pages!');
        console.log('='.repeat(60));
        
        return true;
        
    } catch (error: any) {
        console.error(`❌ FAILED: ${error.message}`);
        if (error.stack) {
            console.error('   Stack:', error.stack.split('\n').slice(1, 4).join('\n'));
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('❌ ANUBIS CHALLENGE HANDLING FAILED');
        console.log('='.repeat(60));
        
        return false;
    }
}

// Run test
testOrleansWithAnubis().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});