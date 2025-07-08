#!/usr/bin/env node

console.log('🔍 Verona Library Timeout Diagnosis');
console.log('Testing SSL certificate issues and timeout handling');

const https = require('https');
const { URL } = require('url');

async function testVeronaSSL() {
    const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
    const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';
    
    console.log('\n📋 Testing URLs:');
    console.log(`  Original: ${testUrl}`);
    console.log(`  Manifest: ${manifestUrl}`);
    
    // Test 1: Original URL with standard fetch (should fail)
    console.log('\n🔧 Test 1: Standard fetch to original URL');
    try {
        const response = await fetch(testUrl, { 
            timeout: 30000,
            signal: AbortSignal.timeout(30000)
        });
        console.log(`✅ Standard fetch succeeded: ${response.status}`);
    } catch (error) {
        console.log(`❌ Standard fetch failed: ${error.message}`);
        if (error.message.includes('certificate') || error.message.includes('SSL')) {
            console.log('   🔍 SSL certificate issue detected');
        }
        if (error.message.includes('timeout') || error.message.includes('AbortError')) {
            console.log('   ⏰ Timeout issue detected');
        }
    }
    
    // Test 2: Original URL with SSL bypass using https module
    console.log('\n🔧 Test 2: HTTPS module with SSL bypass to original URL');
    try {
        const result = await httpsRequest(testUrl, { rejectUnauthorized: false });
        console.log(`✅ HTTPS SSL bypass succeeded: ${result.statusCode}`);
    } catch (error) {
        console.log(`❌ HTTPS SSL bypass failed: ${error.message}`);
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            console.log('   ⏰ Timeout issue detected');
        }
    }
    
    // Test 3: Manifest URL with standard fetch (should work)
    console.log('\n🔧 Test 3: Standard fetch to manifest URL');
    try {
        const response = await fetch(manifestUrl, { 
            timeout: 30000,
            signal: AbortSignal.timeout(30000)
        });
        console.log(`✅ Manifest fetch succeeded: ${response.status}`);
        
        if (response.ok) {
            const manifest = await response.json();
            const pageCount = manifest.sequences?.[0]?.canvases?.length || 0;
            console.log(`   📄 Pages in manifest: ${pageCount}`);
        }
    } catch (error) {
        console.log(`❌ Manifest fetch failed: ${error.message}`);
    }
    
    // Test 4: Timeout stress test
    console.log('\n🔧 Test 4: Timeout stress test with various durations');
    const timeouts = [5000, 10000, 30000, 60000];
    
    for (const timeout of timeouts) {
        console.log(`   Testing ${timeout}ms timeout...`);
        try {
            const result = await httpsRequest(testUrl, { 
                rejectUnauthorized: false,
                timeout: timeout
            });
            console.log(`   ✅ ${timeout}ms: Success (${result.statusCode})`);
            break; // If successful, no need to test longer timeouts
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log(`   ⏰ ${timeout}ms: Timeout`);
            } else {
                console.log(`   ❌ ${timeout}ms: ${error.message}`);
            }
        }
    }
    
    console.log('\n📊 Diagnosis Summary:');
    console.log('1. Testing whether issue is SSL certificates vs timeouts');
    console.log('2. Identifying optimal timeout values for Verona requests');
    console.log('3. Verifying manifest URL accessibility');
}

function httpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            rejectUnauthorized: options.rejectUnauthorized !== false
        };
        
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    body: body.toString()
                });
            });
        });
        
        req.on('error', reject);
        
        if (options.timeout) {
            req.setTimeout(options.timeout, () => {
                req.destroy();
                reject(new Error(`Request timeout after ${options.timeout}ms`));
            });
        }
        
        req.end();
    });
}

// Run the diagnosis
testVeronaSSL().catch(console.error);