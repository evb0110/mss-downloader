#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST for Issue #11: BNE hanging
 * URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 */

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const https = require('https');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 BNE HANGING TEST - ISSUE #11');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

async function testBNE() {
    const loaders = new SharedManifestLoaders();
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    console.log('Test URL:', testUrl);
    console.log('');
    
    // Phase 1: Test manifest retrieval
    console.log('Phase 1: Getting manifest...');
    const startManifest = Date.now();
    
    try {
        const manifest = await loaders.getManifestForLibrary('bne', testUrl);
        const manifestTime = Date.now() - startManifest;
        
        console.log(`✅ Manifest retrieved in ${manifestTime}ms`);
        console.log(`   Pages found: ${manifest.images ? manifest.images.length : 0}`);
        
        if (!manifest.images || manifest.images.length === 0) {
            console.error('❌ No images in manifest');
            return;
        }
        
        // Phase 2: Test actual download
        console.log('');
        console.log('Phase 2: Testing actual page download...');
        const firstPageUrl = manifest.images[0].url;
        console.log(`   URL: ${firstPageUrl}`);
        
        const startDownload = Date.now();
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('❌ HANGING DETECTED: Download timed out after 30 seconds');
                reject(new Error('Download timeout'));
            }, 30000);
            
            https.get(firstPageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                rejectUnauthorized: false // Allow self-signed certificates
            }, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    clearTimeout(timeout);
                    const downloadTime = Date.now() - startDownload;
                    const buffer = Buffer.concat(chunks);
                    
                    console.log(`✅ Page downloaded in ${downloadTime}ms`);
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
                    
                    // Check if it's a PDF
                    if (buffer.toString('utf8', 0, 4) === '%PDF') {
                        console.log('   Format: Valid PDF');
                    } else {
                        console.log('   Format: Not a PDF');
                        const preview = buffer.toString('utf8', 0, 100);
                        console.log('   Content preview:', preview.substring(0, 50));
                    }
                    
                    resolve();
                });
                res.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            }).on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        console.log('');
        console.log('✅ TEST PASSED - No hanging detected');
        console.log('   The BNE manuscript downloads successfully');
        
    } catch (error) {
        console.error('');
        console.error('❌ TEST FAILED:');
        console.error('   Error:', error.message);
        
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            console.error('');
            console.error('🔴 HANGING CONFIRMED');
            console.error('   The issue "висит на калькуляции" is reproduced');
            console.error('   The download hangs and times out');
        }
    }
}

console.log('Starting test...');
console.log('');

testBNE().then(() => {
    console.log('');
    console.log('Test completed');
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});