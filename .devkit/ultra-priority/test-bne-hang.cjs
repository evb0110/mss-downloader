#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Test for Issue #11 - BNE hanging on calculation
 * URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const https = require('https');

async function testBNEHang() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-DEEP BNE HANG ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Testing URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    // Test Phase 1: Parse URL
    console.log('📍 Phase 1: Parsing URL...');
    const startParse = Date.now();
    
    try {
        // Add timeout tracking
        let hangDetected = false;
        const hangTimeout = setTimeout(() => {
            hangDetected = true;
            console.error('❌ HANG DETECTED: Operation stuck for >30 seconds!');
            console.error('   This is likely where user experiences "висит на калькуляции"');
        }, 30000);
        
        const result = await loaders.parseManuscriptUrl(url);
        clearTimeout(hangTimeout);
        
        const parseTime = Date.now() - startParse;
        console.log(`✅ Parsing completed in ${parseTime}ms`);
        
        if (hangDetected) {
            console.log('   But it took too long - user would perceive this as hanging');
        }
        
        // Analyze result
        console.log('');
        console.log('📊 Result Analysis:');
        console.log(`   Total images found: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`   First page URL: ${result.images[0].url}`);
            console.log(`   Last page URL: ${result.images[result.images.length - 1].url}`);
            
            // Test Phase 2: Test actual PDF download
            console.log('');
            console.log('📍 Phase 2: Testing PDF download speed...');
            const testUrl = result.images[0].url;
            const downloadStart = Date.now();
            
            await testPDFDownload(testUrl);
            
            const downloadTime = Date.now() - downloadStart;
            console.log(`   Download test completed in ${downloadTime}ms`);
            
            // Phase 3: Calculation simulation
            console.log('');
            console.log('📍 Phase 3: Simulating calculation phase...');
            const calcStart = Date.now();
            
            // Simulate what happens during calculation
            let totalSize = 0;
            for (let i = 0; i < Math.min(10, result.images.length); i++) {
                console.log(`   Calculating page ${i + 1}...`);
                // Simulate size calculation
                totalSize += Math.random() * 1024 * 1024; // Random size for simulation
            }
            
            const calcTime = Date.now() - calcStart;
            console.log(`✅ Calculation completed in ${calcTime}ms`);
            console.log(`   Estimated total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // Summary
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 ANALYSIS SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total operation time: ${Date.now() - startParse}ms`);
        
        if (parseTime > 10000) {
            console.log('⚠️  PROBLEM IDENTIFIED: Parsing takes too long (>10s)');
            console.log('   This is likely causing the "висит на калькуляции" issue');
        }
        
        return result;
        
    } catch (error) {
        const errorTime = Date.now() - startParse;
        console.error(`❌ ERROR after ${errorTime}ms: ${error.message}`);
        console.error('Stack trace:', error.stack);
        
        if (errorTime > 10000) {
            console.error('');
            console.error('🚨 CRITICAL: Error occurred after long delay');
            console.error('   This confirms the hanging issue!');
        }
        
        throw error;
    }
}

async function testPDFDownload(url) {
    return new Promise((resolve, reject) => {
        const options = {
            rejectUnauthorized: false,
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        https.get(url, options, (res) => {
            if (res.statusCode === 200) {
                console.log(`   ✅ PDF accessible (status: ${res.statusCode})`);
            } else {
                console.log(`   ⚠️  PDF status: ${res.statusCode}`);
            }
            res.on('data', () => {}); // Drain response
            res.on('end', resolve);
        }).on('error', (err) => {
            console.log(`   ❌ PDF download error: ${err.message}`);
            resolve(); // Don't fail the test
        }).on('timeout', () => {
            console.log('   ⚠️  PDF download timeout');
            resolve();
        });
    });
}

// Run the test
testBNEHang().catch(console.error);