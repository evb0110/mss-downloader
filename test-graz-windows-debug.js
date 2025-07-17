#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fetch = require('node-fetch');
const { URL } = require('url');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== University of Graz Windows Debug Script ===');
console.log('Platform:', process.platform);
console.log('Node version:', process.version);
console.log('Date:', new Date().toISOString());
console.log('');

const TEST_URL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
const MANIFEST_ID = '8224538';
const MANIFEST_URL = `https://unipub.uni-graz.at/i3f/v20/${MANIFEST_ID}/manifest`;
const TEST_IMAGE_URL = 'https://unipub.uni-graz.at/download/webcache/2000/8224544';

async function testWithNodeFetch() {
    console.log('1. Testing with node-fetch...');
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(MANIFEST_URL, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeout);
        
        console.log('   Status:', response.status);
        console.log('   Headers:', response.headers.raw());
        
        if (response.ok) {
            const text = await response.text();
            console.log('   Response size:', text.length, 'bytes');
            console.log('   First 200 chars:', text.substring(0, 200));
            
            try {
                const manifest = JSON.parse(text);
                console.log('   ✓ Valid JSON manifest');
                console.log('   Manifest type:', manifest['@type'] || 'Unknown');
                console.log('   Label:', manifest.label || 'No label');
                if (manifest.sequences && manifest.sequences[0]) {
                    console.log('   Canvas count:', manifest.sequences[0].canvases?.length || 0);
                }
            } catch (e) {
                console.log('   ✗ Invalid JSON:', e.message);
            }
        } else {
            console.log('   ✗ Failed with status:', response.status);
        }
    } catch (error) {
        console.log('   ✗ Error:', error.message);
        if (error.code) console.log('   Error code:', error.code);
        if (error.errno) console.log('   Error errno:', error.errno);
    }
    console.log('');
}

async function testWithHttpsModule() {
    console.log('2. Testing with native https module...');
    
    return new Promise((resolve) => {
        const url = new URL(MANIFEST_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000,
            rejectUnauthorized: true
        };
        
        const req = https.request(options, (res) => {
            console.log('   Status:', res.statusCode);
            console.log('   Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('   Response size:', data.length, 'bytes');
                console.log('   First 200 chars:', data.substring(0, 200));
                
                try {
                    const manifest = JSON.parse(data);
                    console.log('   ✓ Valid JSON manifest');
                } catch (e) {
                    console.log('   ✗ Invalid JSON:', e.message);
                }
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log('   ✗ Error:', error.message);
            if (error.code) console.log('   Error code:', error.code);
            console.log('');
            resolve();
        });
        
        req.on('timeout', () => {
            console.log('   ✗ Request timeout');
            req.destroy();
            console.log('');
            resolve();
        });
        
        req.end();
    });
}

async function testWithHttpsModuleNoSSL() {
    console.log('3. Testing with https module (SSL verification disabled)...');
    
    return new Promise((resolve) => {
        const url = new URL(MANIFEST_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000,
            rejectUnauthorized: false
        };
        
        const req = https.request(options, (res) => {
            console.log('   Status:', res.statusCode);
            console.log('   SSL cipher:', res.socket.getCipher ? JSON.stringify(res.socket.getCipher()) : 'N/A');
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('   Response size:', data.length, 'bytes');
                console.log('   ✓ Success with SSL verification disabled');
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log('   ✗ Error:', error.message);
            console.log('');
            resolve();
        });
        
        req.end();
    });
}

async function testImageDownload() {
    console.log('4. Testing image download...');
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(TEST_IMAGE_URL, {
            signal: controller.signal,
            headers: {
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeout);
        
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        console.log('   Content-Length:', response.headers.get('content-length'));
        
        if (response.ok) {
            const buffer = await response.buffer();
            console.log('   ✓ Downloaded', buffer.length, 'bytes');
            
            // Check if it's a valid image
            if (buffer.length > 1000) {
                console.log('   ✓ Image size looks valid');
            } else {
                console.log('   ✗ Image too small, might be an error page');
            }
        } else {
            console.log('   ✗ Failed with status:', response.status);
        }
    } catch (error) {
        console.log('   ✗ Error:', error.message);
    }
    console.log('');
}

async function testCurlCommand() {
    console.log('5. Testing with curl command...');
    
    if (process.platform === 'win32') {
        console.log('   Checking if curl is available on Windows...');
        try {
            const curlVersion = execSync('curl --version', { encoding: 'utf8' });
            console.log('   Curl version:', curlVersion.split('\n')[0]);
        } catch (e) {
            console.log('   ✗ Curl not available or not in PATH');
            console.log('');
            return;
        }
    }
    
    try {
        const curlCmd = `curl -s -I -m 30 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Accept: application/json" "${MANIFEST_URL}"`;
        console.log('   Command:', curlCmd);
        
        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 35000 });
        const lines = result.split('\n');
        console.log('   Response headers:');
        lines.slice(0, 10).forEach(line => {
            if (line.trim()) console.log('     ', line.trim());
        });
        
        if (result.includes('200 OK')) {
            console.log('   ✓ Curl request successful');
        } else {
            console.log('   ✗ Unexpected response');
        }
    } catch (error) {
        console.log('   ✗ Curl error:', error.message);
    }
    console.log('');
}

async function testDNSResolution() {
    console.log('6. Testing DNS resolution...');
    
    const dns = require('dns').promises;
    try {
        const addresses = await dns.resolve4('unipub.uni-graz.at');
        console.log('   IPv4 addresses:', addresses);
        
        try {
            const addresses6 = await dns.resolve6('unipub.uni-graz.at');
            console.log('   IPv6 addresses:', addresses6);
        } catch (e) {
            console.log('   IPv6: Not available or not configured');
        }
        
        // Reverse DNS
        for (const addr of addresses) {
            try {
                const hostnames = await dns.reverse(addr);
                console.log(`   Reverse DNS for ${addr}:`, hostnames);
            } catch (e) {
                console.log(`   Reverse DNS for ${addr}: Failed`);
            }
        }
    } catch (error) {
        console.log('   ✗ DNS resolution failed:', error.message);
    }
    console.log('');
}

async function testProxy() {
    console.log('7. Testing via CORS proxy...');
    
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(MANIFEST_URL)}`;
    
    try {
        const response = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('   Proxy status:', response.status);
        
        if (response.ok) {
            const text = await response.text();
            console.log('   Response size:', text.length, 'bytes');
            console.log('   ✓ Proxy request successful');
        } else {
            console.log('   ✗ Proxy request failed');
        }
    } catch (error) {
        console.log('   ✗ Proxy error:', error.message);
    }
    console.log('');
}

async function checkWindowsSpecific() {
    if (process.platform !== 'win32') {
        console.log('8. Windows-specific checks: Skipped (not Windows)');
        return;
    }
    
    console.log('8. Windows-specific checks...');
    
    // Check Windows version
    try {
        const osInfo = execSync('wmic os get Caption,Version /value', { encoding: 'utf8' });
        console.log('   Windows info:', osInfo.replace(/\r\n/g, ' ').trim());
    } catch (e) {
        console.log('   Could not get Windows version');
    }
    
    // Check proxy settings
    try {
        const proxySettings = execSync('netsh winhttp show proxy', { encoding: 'utf8' });
        console.log('   Proxy settings:', proxySettings.includes('Direct access') ? 'Direct access (no proxy)' : 'Proxy configured');
    } catch (e) {
        console.log('   Could not check proxy settings');
    }
    
    // Check certificate store
    try {
        const certInfo = execSync('certutil -store -silent Root | findstr "uni-graz.at"', { encoding: 'utf8' });
        console.log('   Graz certificates in store:', certInfo ? 'Found' : 'Not found');
    } catch (e) {
        console.log('   No specific Graz certificates in Windows store');
    }
    
    console.log('');
}

async function runAllTests() {
    console.log('Starting comprehensive Graz debugging...\n');
    
    await testDNSResolution();
    await testWithNodeFetch();
    await testWithHttpsModule();
    await testWithHttpsModuleNoSSL();
    await testImageDownload();
    await testCurlCommand();
    await testProxy();
    await checkWindowsSpecific();
    
    console.log('=== Summary ===');
    console.log('Please share the complete output above with the developer.');
    console.log('This will help identify whether the issue is:');
    console.log('- SSL/TLS certificate validation');
    console.log('- DNS resolution');
    console.log('- Timeout settings');
    console.log('- Windows-specific network configuration');
    console.log('- Proxy/firewall blocking');
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});