#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Heidelberg Library Issue #19
 * Testing with exact user URL to reproduce the error
 */

const { SharedManifestLoaders } = require('../../../../src/shared/SharedManifestLoaders.js');

async function testHeidelberg() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-DEEP HEIDELBERG ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const loader = new SharedManifestLoaders();
    
    // Test URLs from issue
    const testUrls = [
        'https://digi.ub.uni-heidelberg.de/diglit/salVIII2',  // User's exact URL
        'https://digi.ub.uni-heidelberg.de/diglit/iiif3/salVIII2/manifest',  // IIIF v3
        'https://digi.ub.uni-heidelberg.de/diglit/iiif/salVIII2/manifest',   // IIIF v2
    ];
    
    for (const url of testUrls) {
        console.log(`\n📍 Testing URL: ${url}`);
        console.log('─'.repeat(50));
        
        try {
            // First check what the URL returns
            console.log('1️⃣ Checking URL response...');
            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            console.log(`   Content-Type: ${contentType}`);
            console.log(`   Status: ${response.status}`);
            
            if (contentType?.includes('html')) {
                const text = await response.text();
                console.log(`   ⚠️ HTML detected instead of JSON!`);
                console.log(`   First 200 chars: ${text.substring(0, 200)}`);
                
                // Check if it's a redirect or viewer page
                if (text.includes('manifest')) {
                    const manifestUrlMatch = text.match(/manifest[^"']*\.json|\/manifest/gi);
                    if (manifestUrlMatch) {
                        console.log(`   🔗 Found manifest reference: ${manifestUrlMatch[0]}`);
                    }
                }
            } else if (contentType?.includes('json')) {
                const data = await response.json();
                console.log(`   ✅ JSON response received`);
                console.log(`   Type: ${data['@type'] || data.type || 'unknown'}`);
                console.log(`   ID: ${data['@id'] || data.id || 'none'}`);
            }
            
            // Now try to load via SharedManifestLoaders
            console.log('\n2️⃣ Testing via SharedManifestLoaders...');
            const manifest = await loader.getManifestForLibrary('heidelberg', url);
            
            console.log(`   ✅ Manifest loaded successfully!`);
            console.log(`   Title: ${manifest.displayName}`);
            console.log(`   Pages: ${manifest.images.length}`);
            console.log(`   First page URL: ${manifest.images[0]?.url}`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            console.log(`   Stack: ${error.stack?.split('\n')[1]}`);
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 ROOT CAUSE ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // The user's URL doesn't include /manifest, it's a viewer page
    // We need to construct the manifest URL from the viewer URL
    const userUrl = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
    console.log(`\nUser URL pattern: ${userUrl}`);
    console.log('Expected manifest URLs:');
    console.log('  - IIIF v3: https://digi.ub.uni-heidelberg.de/diglit/iiif3/salVIII2/manifest');
    console.log('  - IIIF v2: https://digi.ub.uni-heidelberg.de/diglit/iiif/salVIII2/manifest');
    
    // The error "is not valid JSON" suggests the URL is returning HTML
    // This happens when the manifest URL is incorrectly constructed
}

testHeidelberg().catch(console.error);