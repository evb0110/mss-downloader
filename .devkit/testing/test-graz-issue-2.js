#!/usr/bin/env node
/**
 * ULTRA-PRIORITY Test for Issue #2 - University of Graz IPC timeout
 * Testing with the exact URL from the user: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testGrazManifest() {
    const userUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688';
    console.log(`\n🔥 ULTRA-PRIORITY TEST for Issue #2`);
    console.log(`Testing URL: ${userUrl}`);
    console.log('='.repeat(60));
    
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('\n1. Testing URL parsing and manifest URL construction...');
        
        // Parse manuscript ID
        const manuscriptIdMatch = userUrl.match(/\/(\d+)$/);
        if (!manuscriptIdMatch) {
            throw new Error('Could not extract manuscript ID from URL');
        }
        const manuscriptId = manuscriptIdMatch[1];
        console.log(`   ✅ Extracted manuscript ID: ${manuscriptId}`);
        
        // Construct manifest URL
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        console.log(`   ✅ Constructed manifest URL: ${manifestUrl}`);
        
        console.log('\n2. Attempting to fetch manifest...');
        const startTime = Date.now();
        
        // Test with timeout wrapper to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('TIMEOUT: Manifest loading took more than 30 seconds'));
            }, 30000);
        });
        
        const manifestPromise = loaders.getManifestForLibrary('graz', userUrl);
        
        const manifest = await Promise.race([manifestPromise, timeoutPromise]);
        
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ Manifest loaded in ${loadTime} seconds`);
        
        console.log('\n3. Analyzing manifest content...');
        console.log(`   Title: ${manifest.title || 'No title'}`);
        console.log(`   Pages: ${manifest.images?.length || 0}`);
        console.log(`   Library: ${manifest.library}`);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log('\n4. Sample pages:');
            // Show first 3 and last 3 pages
            const samplesToShow = 3;
            for (let i = 0; i < Math.min(samplesToShow, manifest.images.length); i++) {
                console.log(`   Page ${i + 1}: ${manifest.images[i].label || 'No label'}`);
                console.log(`      URL: ${manifest.images[i].url?.substring(0, 80)}...`);
            }
            
            if (manifest.images.length > samplesToShow * 2) {
                console.log('   ...');
                for (let i = manifest.images.length - samplesToShow; i < manifest.images.length; i++) {
                    console.log(`   Page ${i + 1}: ${manifest.images[i].label || 'No label'}`);
                    console.log(`      URL: ${manifest.images[i].url?.substring(0, 80)}...`);
                }
            }
        }
        
        console.log('\n✅ SUCCESS: Manifest loaded without IPC timeout issues!');
        console.log('   The backend can successfully fetch the manifest.');
        console.log('   The IPC timeout issue must be in the Electron IPC communication layer.');
        
    } catch (error) {
        console.error('\n❌ ERROR REPRODUCED - This is the root cause:');
        console.error(`   Error type: ${error.constructor.name}`);
        console.error(`   Error message: ${error.message}`);
        
        if (error.message.includes('TIMEOUT')) {
            console.error('\n🔍 DIAGNOSIS: The manifest is taking too long to load.');
            console.error('   This could be due to:');
            console.error('   1. Server being slow to respond');
            console.error('   2. Very large manifest size');
            console.error('   3. Network connectivity issues');
            console.error('   4. SSL/TLS negotiation problems');
        } else if (error.message.includes('fetch')) {
            console.error('\n🔍 DIAGNOSIS: Network fetch failed.');
            console.error('   This could be due to:');
            console.error('   1. SSL certificate issues');
            console.error('   2. DNS resolution problems');
            console.error('   3. Firewall blocking the request');
            console.error('   4. Server rejecting the request');
        } else {
            console.error('\n🔍 DIAGNOSIS: Unexpected error type.');
            console.error('   Full error:', error);
        }
        
        console.error('\n📊 ERROR DETAILS:');
        console.error(error.stack);
        
        process.exit(1);
    }
}

// Run the test
testGrazManifest().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});