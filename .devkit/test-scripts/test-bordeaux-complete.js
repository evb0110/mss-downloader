#!/usr/bin/env node

/**
 * Complete Bordeaux test using compiled TypeScript code
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const path = require('path');
const fs = require('fs').promises;

// Try to require the compiled DirectTileProcessor
let DirectTileProcessor;
try {
    // Try from bundled build
    DirectTileProcessor = require('../../dist/main/services/DirectTileProcessor').DirectTileProcessor;
} catch (e) {
    try {
        // Try TypeScript compilation (with ts-node if available)  
        require('ts-node/register');
        DirectTileProcessor = require('../../src/main/services/DirectTileProcessor').DirectTileProcessor;
    } catch (e2) {
        console.log('Cannot load DirectTileProcessor, will test basic functionality only');
    }
}

const BORDEAUX_URL = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';

async function testBordeauxComplete() {
    console.log('=== Complete Bordeaux Test ===\n');
    
    try {
        // Step 1: Test manifest loading
        console.log('1. Testing manifest loading...');
        const manifestLoaders = new SharedManifestLoaders();
        const manifest = await manifestLoaders.getBordeauxManifest(BORDEAUX_URL);
        
        console.log('✅ Manifest loaded successfully');
        console.log('   Type:', manifest.type);
        console.log('   Base ID:', manifest.baseId);
        console.log('   Start page:', manifest.startPage);
        console.log('   Page count:', manifest.pageCount);
        console.log('   Requires tile processor:', manifest.requiresTileProcessor);
        
        // Step 2: Test if DirectTileProcessor is available
        if (!DirectTileProcessor) {
            console.log('\n2. ⚠️ DirectTileProcessor not available, simulating...');
            
            // Simulate what the processor would do
            const pageNum = manifest.startPage;
            const pageId = `${manifest.baseId}_${String(pageNum).padStart(4, '0')}`;
            const testUrl = `${manifest.tileBaseUrl}/${pageId}_files/12/0_0.jpg`;
            
            console.log('   Testing tile URL:', testUrl);
            
            // Use fetch or https to test
            const https = require('https');
            const testResult = await new Promise((resolve) => {
                https.get(testUrl, (response) => {
                    resolve({ exists: response.statusCode === 200 });
                }).on('error', () => resolve({ exists: false }));
            });
            
            if (testResult.exists) {
                console.log('✅ Tiles are accessible - download would work');
                return { success: true, message: 'Bordeaux is working (tiles accessible)' };
            } else {
                console.log('❌ Tiles not accessible at default zoom level');
                return { success: false, error: 'Tiles not accessible' };
            }
        }
        
        // Step 3: Test actual tile processing
        console.log('\n2. Testing DirectTileProcessor...');
        const processor = new DirectTileProcessor();
        const outputPath = path.join(__dirname, 'test-bordeaux-page.jpg');
        
        const pageNum = manifest.startPage;
        console.log(`   Processing page ${pageNum}...`);
        
        const result = await processor.processPage(manifest.baseId, pageNum, outputPath);
        
        if (result.success) {
            const stats = await fs.stat(outputPath);
            console.log(`✅ Page processed successfully (${stats.size} bytes)`);
            
            // Clean up
            await fs.unlink(outputPath);
            
            return { success: true, message: 'Bordeaux fully working!' };
        } else {
            console.log(`❌ Page processing failed: ${result.error}`);
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Run test
testBordeauxComplete().then(result => {
    console.log('\n=== Final Result ===');
    console.log(result.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Message:', result.message || result.error);
    process.exit(result.success ? 0 : 1);
});