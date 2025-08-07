#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Production Test for Issue #11 - BNE hanging on calculation
 * URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
 * This test uses the ACTUAL production code paths
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testBNEProductionHang() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 ULTRA-DEEP BNE PRODUCTION CODE ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Testing URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1');
    console.log('User reports: "висит на калькуляции" (hangs on calculation)');
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    
    // Phase 1: Test getBNEManifest directly
    console.log('📍 Phase 1: Testing getBNEManifest directly...');
    const startTime = Date.now();
    
    try {
        // Monitor for hanging
        let hangDetected = false;
        let hangPhase = '';
        
        const hangMonitor = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 5000 && elapsed < 5100) {
                console.log('   ⏱️  5 seconds elapsed...');
            } else if (elapsed > 10000 && elapsed < 10100) {
                console.log('   ⏱️  10 seconds elapsed...');
                hangPhase = 'HEAD request or HTML fetch';
            } else if (elapsed > 20000 && elapsed < 20100) {
                console.log('   ⏱️  20 seconds elapsed...');
                hangPhase = 'HTML parsing or network timeout';
            } else if (elapsed > 30000 && elapsed < 30100) {
                hangDetected = true;
                console.log('   ❌ 30 SECONDS! This is perceived as HANG by user!');
                hangPhase = 'Critical timeout - user would close app';
            }
        }, 100);
        
        const result = await loaders.getBNEManifest(url);
        clearInterval(hangMonitor);
        
        const totalTime = Date.now() - startTime;
        
        if (hangDetected) {
            console.log(`   ⚠️  HANG CONFIRMED: Operation took ${totalTime}ms`);
            console.log(`   Likely stuck in: ${hangPhase}`);
        } else if (totalTime > 10000) {
            console.log(`   ⚠️  SLOW: Operation took ${totalTime}ms (user perceives as hanging)`);
        } else {
            console.log(`   ✅ Completed in ${totalTime}ms`);
        }
        
        // Analyze result
        console.log('');
        console.log('📊 Manifest Analysis:');
        console.log(`   Total images: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`   First URL: ${result.images[0].url}`);
            console.log(`   Last URL: ${result.images[result.images.length - 1].url}`);
            
            // Check URL pattern
            const pdfRawPattern = /pdf\.raw.*page=\d+/;
            const usesPdfRaw = result.images[0].url.match(pdfRawPattern);
            console.log(`   Uses pdf.raw: ${usesPdfRaw ? 'YES' : 'NO'}`);
        }
        
        // Phase 2: Test the actual network request
        console.log('');
        console.log('📍 Phase 2: Testing network connectivity to BNE...');
        await testNetworkLatency();
        
        // Phase 3: Test HEAD request (what BNE code does first)
        console.log('');
        console.log('📍 Phase 3: Testing HEAD request (BNE code path)...');
        const headStart = Date.now();
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&pdf=true`;
        
        try {
            const https = require('https');
            await new Promise((resolve, reject) => {
                const req = https.request(testUrl, {
                    method: 'HEAD',
                    rejectUnauthorized: false,
                    timeout: 15000
                }, (res) => {
                    const headTime = Date.now() - headStart;
                    console.log(`   HEAD status: ${res.statusCode} in ${headTime}ms`);
                    if (headTime > 10000) {
                        console.log('   ⚠️  HEAD request is SLOW - this contributes to hang!');
                    }
                    resolve(res);
                });
                
                req.on('timeout', () => {
                    console.log('   ❌ HEAD request TIMEOUT - THIS IS THE HANG!');
                    reject(new Error('HEAD timeout'));
                });
                
                req.on('error', (err) => {
                    console.log(`   ❌ HEAD request error: ${err.message}`);
                    reject(err);
                });
                
                req.end();
            });
        } catch (err) {
            console.log(`   Error details: ${err.message}`);
        }
        
        // Phase 4: Test HTML fallback
        console.log('');
        console.log('📍 Phase 4: Testing HTML fallback (if HEAD fails)...');
        const htmlStart = Date.now();
        const viewerUrl = `https://bdh-rd.bne.es/viewer.vm?id=0000007619`;
        
        try {
            const response = await loaders.fetchUrl(viewerUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const htmlTime = Date.now() - htmlStart;
            console.log(`   HTML fetch completed in ${htmlTime}ms`);
            
            if (htmlTime > 10000) {
                console.log('   ⚠️  HTML fetch is SLOW - causes perceived hang!');
            }
            
            const html = await response.text();
            console.log(`   HTML size: ${html.length} bytes`);
            
            // Check for total pages in HTML
            const totalPagesMatch = html.match(/totalPages['":\s]+(\d+)/);
            if (totalPagesMatch) {
                console.log(`   Found totalPages in HTML: ${totalPagesMatch[1]}`);
            }
        } catch (err) {
            console.log(`   HTML fetch error: ${err.message}`);
        }
        
        // Summary
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 ROOT CAUSE ANALYSIS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (totalTime > 30000) {
            console.log('❌ CRITICAL HANG DETECTED');
            console.log('   The operation takes >30 seconds');
            console.log('   User experiences this as complete freeze');
        } else if (totalTime > 10000) {
            console.log('⚠️  PERCEIVED HANG DETECTED'); 
            console.log(`   Operation took ${totalTime}ms`);
            console.log('   Users perceive >10s as hanging');
        } else {
            console.log('✅ No hang detected in test environment');
            console.log(`   Operation completed in ${totalTime}ms`);
            console.log('   BUT: User still reports hanging');
            console.log('   Possible causes:');
            console.log('   - Network conditions differ');
            console.log('   - Electron environment adds overhead');
            console.log('   - Calculation phase after manifest load');
        }
        
        return result;
        
    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`❌ ERROR after ${errorTime}ms: ${error.message}`);
        
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            console.error('');
            console.error('🚨 TIMEOUT ERROR - THIS IS THE HANG!');
            console.error('   The operation times out, causing the hang');
        }
        
        throw error;
    }
}

async function testNetworkLatency() {
    const https = require('https');
    const testUrls = [
        'https://bdh-rd.bne.es',
        'https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&pdf=true'
    ];
    
    for (const url of testUrls) {
        const start = Date.now();
        try {
            await new Promise((resolve, reject) => {
                https.get(url, { 
                    rejectUnauthorized: false,
                    timeout: 5000
                }, (res) => {
                    const latency = Date.now() - start;
                    console.log(`   ${url.substring(0, 30)}... - ${res.statusCode} in ${latency}ms`);
                    res.on('data', () => {});
                    res.on('end', resolve);
                }).on('error', reject);
            });
        } catch (err) {
            console.log(`   ${url.substring(0, 30)}... - ERROR: ${err.message}`);
        }
    }
}

// Run the test
console.log('Starting ULTRA-PRIORITY test for BNE hang issue...\n');
testBNEProductionHang().catch(console.error);