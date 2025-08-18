#!/usr/bin/env node

const http = require('http');

function checkPageDetails(pageNum) {
    return new Promise((resolve) => {
        const url = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/${pageNum}/original`;
        
        console.log(`\n=== Page ${pageNum} Analysis ===`);
        console.log(`URL: ${url}`);
        
        const req = http.get(url, { timeout: 10000 }, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Content-Type: ${res.headers['content-type'] || 'not set'}`);
            console.log(`Content-Length: ${res.headers['content-length'] || 'not set'}`);
            
            let data = '';
            let bytesReceived = 0;
            
            res.on('data', (chunk) => {
                data += chunk;
                bytesReceived += chunk.length;
                
                // Only collect first 1KB to check content type
                if (bytesReceived > 1024) {
                    res.destroy(); // Stop downloading
                }
            });
            
            res.on('end', () => {
                console.log(`Actual bytes received: ${bytesReceived}`);
                
                // Check if content looks like HTML (phantom page)
                if (data.includes('<html') || data.includes('<HTML')) {
                    console.log(`❌ PHANTOM PAGE - HTML content detected`);
                    console.log(`HTML preview: ${data.substring(0, 200)}...`);
                } else if (bytesReceived > 0 && data.toString().startsWith('\xFF\xD8')) {
                    console.log(`✅ REAL IMAGE - JPEG header detected`);
                } else if (bytesReceived > 0) {
                    console.log(`❓ UNKNOWN CONTENT - First 100 bytes: ${data.substring(0, 100)}`);
                } else {
                    console.log(`❌ EMPTY RESPONSE`);
                }
                
                resolve({
                    status: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: res.headers['content-length'],
                    actualBytes: bytesReceived,
                    isHTML: data.includes('<html') || data.includes('<HTML'),
                    isJPEG: data.toString().startsWith('\xFF\xD8')
                });
            });
            
            res.on('close', () => {
                resolve({
                    status: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: res.headers['content-length'],
                    actualBytes: bytesReceived,
                    isHTML: data.includes('<html') || data.includes('<HTML'),
                    isJPEG: data.toString().startsWith('\xFF\xD8')
                });
            });
            
        }).on('error', (err) => {
            console.log(`❌ REQUEST ERROR: ${err.message}`);
            resolve(null);
        }).on('timeout', () => {
            console.log(`❌ REQUEST TIMEOUT`);
            resolve(null);
        });
    });
}

async function analyzeRomePages() {
    console.log('ROME CONTENT ANALYSIS - Checking real vs phantom pages');
    console.log('========================================================');
    
    // Test pages we expect to be real
    console.log('\n🔍 Testing pages expected to be REAL:');
    for (const page of [1, 5, 10]) {
        await checkPageDetails(page);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }
    
    // Test pages that are likely phantom
    console.log('\n🔍 Testing pages expected to be PHANTOM:');
    for (const page of [500, 1000]) {
        await checkPageDetails(page);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }
    
    console.log('\n📊 ANALYSIS COMPLETE');
    console.log('Key question: Do phantom pages return HTML while real pages return JPEG?');
}

analyzeRomePages();