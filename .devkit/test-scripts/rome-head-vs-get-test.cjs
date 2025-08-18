#!/usr/bin/env node

const http = require('http');

function testWithMethod(pageNum, method) {
    return new Promise((resolve) => {
        const url = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/${pageNum}/original`;
        
        console.log(`\n=== Page ${pageNum} - ${method} Request ===`);
        console.log(`URL: ${url}`);
        
        const options = {
            method: method,
            timeout: 10000
        };
        
        const req = http.request(url, options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Content-Type: ${res.headers['content-type'] || 'not set'}`);
            console.log(`Content-Length: ${res.headers['content-length'] || 'not set'}`);
            
            if (method === 'GET') {
                let bytesReceived = 0;
                res.on('data', (chunk) => {
                    bytesReceived += chunk.length;
                    if (bytesReceived > 1024) {
                        res.destroy(); // Stop after 1KB
                    }
                });
                res.on('end', () => {
                    console.log(`Actual bytes received: ${bytesReceived}`);
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers['content-type'],
                        contentLength: res.headers['content-length'],
                        actualBytes: bytesReceived
                    });
                });
                res.on('close', () => {
                    console.log(`Actual bytes received: ${bytesReceived}`);
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers['content-type'],
                        contentLength: res.headers['content-length'],
                        actualBytes: bytesReceived
                    });
                });
            } else {
                // HEAD request - no body
                console.log(`HEAD request completed`);
                resolve({
                    status: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: res.headers['content-length'],
                    actualBytes: 0
                });
            }
        });
        
        req.on('error', (err) => {
            console.log(`❌ REQUEST ERROR: ${err.message}`);
            resolve(null);
        });
        
        req.on('timeout', () => {
            console.log(`❌ REQUEST TIMEOUT`);
            resolve(null);
        });
        
        req.end();
    });
}

async function compareHeadVsGet() {
    console.log('ROME HEAD vs GET COMPARISON');
    console.log('===========================');
    
    // Test page 1 (should be real)
    console.log('\n🧪 Testing PAGE 1 (expected to be real):');
    const page1Head = await testWithMethod(1, 'HEAD');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const page1Get = await testWithMethod(1, 'GET');
    
    console.log('\n📊 Page 1 Comparison:');
    console.log(`HEAD - Status: ${page1Head?.status}, Type: ${page1Head?.contentType}, Length: ${page1Head?.contentLength}`);
    console.log(`GET  - Status: ${page1Get?.status}, Type: ${page1Get?.contentType}, Length: ${page1Get?.contentLength}`);
    
    // Test page 500 (should be phantom)
    console.log('\n🧪 Testing PAGE 500 (expected to be phantom):');
    const page500Head = await testWithMethod(500, 'HEAD');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const page500Get = await testWithMethod(500, 'GET');
    
    console.log('\n📊 Page 500 Comparison:');
    console.log(`HEAD - Status: ${page500Head?.status}, Type: ${page500Head?.contentType}, Length: ${page500Head?.contentLength}`);
    console.log(`GET  - Status: ${page500Get?.status}, Type: ${page500Get?.contentType}, Length: ${page500Get?.contentLength}`);
    
    // Now simulate the exact logic from checkPageExists
    console.log('\n🔍 Simulating checkPageExists logic:');
    
    function simulateCheckPageExists(response, pageNum) {
        if (!response || response.status !== 200) {
            console.log(`Page ${pageNum}: ❌ Not OK status`);
            return false;
        }
        
        const contentType = response.contentType;
        
        // Rome returns 200 OK with text/html for non-existent pages
        if (contentType && contentType.includes('text/html')) {
            console.log(`Page ${pageNum}: ❌ Phantom page detected - HTML response (${contentType})`);
            return false;
        }
        
        // Valid image if it has image content type
        const isValidImage = contentType && contentType.includes('image');
        
        if (isValidImage) {
            console.log(`Page ${pageNum}: ✅ Valid image (${contentType})`);
            return true;
        } else {
            console.log(`Page ${pageNum}: ❌ Invalid content type (${contentType || 'no type'})`);
            return false;
        }
    }
    
    console.log('\nPage 1 HEAD result:', simulateCheckPageExists(page1Head, 1));
    console.log('Page 1 GET result:', simulateCheckPageExists(page1Get, 1));
    console.log('Page 500 HEAD result:', simulateCheckPageExists(page500Head, 500));
    console.log('Page 500 GET result:', simulateCheckPageExists(page500Get, 500));
}

compareHeadVsGet();