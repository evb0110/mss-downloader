#!/usr/bin/env node

const https = require('https');
const dns = require('dns').promises;

/**
 * Test script for issue #3 - Verona connection timeout
 * URL: https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15
 * Error: connect ETIMEDOUT 89.17.160.89:443
 */

async function testConnection(hostname, ip) {
    console.log(`\n=== Testing connection to ${hostname} (${ip}) ===`);
    
    // Test 1: DNS resolution
    try {
        console.log('1. Testing DNS resolution...');
        const addresses = await dns.resolve4(hostname);
        console.log(`   ✓ DNS resolved to: ${addresses.join(', ')}`);
    } catch (error) {
        console.log(`   ✗ DNS resolution failed: ${error.message}`);
    }
    
    // Test 2: Basic HTTPS connection with different timeouts
    const timeouts = [5000, 10000, 30000, 60000];
    
    for (const timeout of timeouts) {
        console.log(`\n2. Testing HTTPS connection with ${timeout}ms timeout...`);
        
        const startTime = Date.now();
        
        try {
            const result = await new Promise((resolve, reject) => {
                const options = {
                    hostname: hostname,
                    port: 443,
                    path: '/',
                    method: 'HEAD',
                    timeout: timeout,
                    rejectUnauthorized: false,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                };
                
                const req = https.request(options, (res) => {
                    const elapsed = Date.now() - startTime;
                    resolve({
                        success: true,
                        statusCode: res.statusCode,
                        headers: res.headers,
                        elapsed
                    });
                });
                
                req.on('error', (error) => {
                    const elapsed = Date.now() - startTime;
                    reject({ error, elapsed });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    const elapsed = Date.now() - startTime;
                    reject({ error: new Error('Request timeout'), elapsed });
                });
                
                req.end();
            });
            
            console.log(`   ✓ Connection successful! Status: ${result.statusCode}, Time: ${result.elapsed}ms`);
            console.log(`   Server: ${result.headers.server || 'Unknown'}`);
            break; // If successful, no need to try longer timeouts
            
        } catch (err) {
            console.log(`   ✗ Connection failed after ${err.elapsed}ms: ${err.error.message}`);
            console.log(`   Error code: ${err.error.code || 'Unknown'}`);
        }
    }
}

async function testManifestAccess() {
    console.log('\n=== Testing IIIF manifest access ===');
    
    // Test both domains
    const testUrls = [
        {
            name: 'NBM main site',
            url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15'
        },
        {
            name: 'NBM IIIF server',
            url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json'
        }
    ];
    
    for (const test of testUrls) {
        console.log(`\nTesting ${test.name}: ${test.url}`);
        
        const urlObj = new URL(test.url);
        const startTime = Date.now();
        
        try {
            const result = await new Promise((resolve, reject) => {
                const options = {
                    hostname: urlObj.hostname,
                    port: 443,
                    path: urlObj.pathname + urlObj.search,
                    method: 'GET',
                    timeout: 30000,
                    rejectUnauthorized: false,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'application/json, text/html, */*'
                    }
                };
                
                const req = https.request(options, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        const elapsed = Date.now() - startTime;
                        resolve({
                            success: true,
                            statusCode: res.statusCode,
                            headers: res.headers,
                            dataLength: data.length,
                            elapsed,
                            contentType: res.headers['content-type'],
                            data: data.substring(0, 200) // First 200 chars
                        });
                    });
                });
                
                req.on('error', (error) => {
                    const elapsed = Date.now() - startTime;
                    reject({ error, elapsed });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    const elapsed = Date.now() - startTime;
                    reject({ error: new Error('Request timeout'), elapsed });
                });
                
                req.end();
            });
            
            console.log(`   ✓ Success! Status: ${result.statusCode}, Time: ${result.elapsed}ms`);
            console.log(`   Content-Type: ${result.contentType}`);
            console.log(`   Data size: ${result.dataLength} bytes`);
            
            if (result.statusCode === 200) {
                console.log(`   First 200 chars: ${result.data}`);
            }
            
        } catch (err) {
            console.log(`   ✗ Failed after ${err.elapsed}ms: ${err.error.message}`);
            console.log(`   Error details:`, err.error);
        }
    }
}

async function testAlternativeAccess() {
    console.log('\n=== Testing alternative access methods ===');
    
    // Try using curl command as fallback
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
    
    console.log('\nTesting with curl command...');
    try {
        const { stdout, stderr } = await execPromise(
            `curl -I -k --connect-timeout 10 --max-time 30 "${testUrl}" 2>&1`
        );
        console.log('Curl output:', stdout);
        if (stderr) console.log('Curl errors:', stderr);
    } catch (error) {
        console.log('Curl failed:', error.message);
    }
}

async function main() {
    console.log('Verona Library Connection Test - Issue #3');
    console.log('=========================================');
    console.log('Target URL: https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15');
    console.log('Reported error: connect ETIMEDOUT 89.17.160.89:443');
    
    // Test main site
    await testConnection('www.nuovabibliotecamanoscritta.it', '89.17.160.89');
    
    // Test IIIF server
    await testConnection('nbm.regione.veneto.it', 'unknown');
    
    // Test manifest access
    await testManifestAccess();
    
    // Test alternative methods
    await testAlternativeAccess();
    
    console.log('\n=== Summary ===');
    console.log('The connection timeout to 89.17.160.89 suggests the main NBM site may be:');
    console.log('1. Behind a firewall blocking external connections');
    console.log('2. Experiencing server issues');
    console.log('3. Using IP-based access restrictions');
    console.log('\nRecommended solution: Use the IIIF server (nbm.regione.veneto.it) instead');
}

main().catch(console.error);