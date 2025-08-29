#!/usr/bin/env node

// Test Arenberg Gospels manifest loading in pure Node.js to identify root cause
// This isolates the issue from Electron environment and queue management

const https = require('https');
const { URL } = require('url');

function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            },
            rejectUnauthorized: true,
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });

        req.on('error', reject);
        
        if (options.timeout) {
            req.setTimeout(options.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        }
        
        req.end();
    });
}

async function testArenbergManifest() {
    console.log('🔍 Testing Arenberg Gospels manifest loading in Node.js...\n');
    
    const url = 'https://www.themorgan.org/collection/arenberg-gospels';
    console.log(`📋 Testing URL: ${url}`);
    
    try {
        console.log('\n1️⃣ Testing basic URL fetch...');
        const startTime = Date.now();
        const response = await fetchDirect(url, { timeout: 30000 });
        const elapsed = Date.now() - startTime;
        
        console.log(`✅ Response: ${response.status} ${response.statusText} (${elapsed}ms)`);
        
        if (!response.ok) {
            console.log('❌ Basic URL fetch failed');
            return;
        }
        
        const content = await response.text();
        console.log(`📄 Content length: ${content.length} characters`);
        
        // Check for key Morgan patterns
        const hasManuscriptCode = content.match(/data-manuscript-code="([^"]+)"/);
        const hasManuscriptId = content.match(/data-manuscript-id="([^"]+)"/);
        const hasImagesDir = content.match(/data-images-dir="([^"]+)"/);
        
        console.log('\n🔍 Pattern analysis:');
        console.log(`   📝 Manuscript code: ${hasManuscriptCode ? hasManuscriptCode[1] : 'NOT FOUND'}`);
        console.log(`   🆔 Manuscript ID: ${hasManuscriptId ? hasManuscriptId[1] : 'NOT FOUND'}`);
        console.log(`   📁 Images directory: ${hasImagesDir ? hasImagesDir[1] : 'NOT FOUND'}`);
        
        // Test thumbs redirect
        console.log('\n2️⃣ Testing thumbs redirect...');
        const thumbsUrl = `${url}/thumbs`;
        console.log(`📋 Testing: ${thumbsUrl}`);
        
        const thumbsResponse = await fetchDirect(thumbsUrl, { timeout: 30000 });
        console.log(`✅ Thumbs response: ${thumbsResponse.status} ${thumbsResponse.statusText}`);
        
        // Test individual page discovery
        console.log('\n3️⃣ Testing individual page discovery...');
        const testPages = [1, 2, 3, 10, 20, 30, 40, 50];
        
        for (const pageNum of testPages) {
            const pageUrl = `${url}/${pageNum}`;
            try {
                console.log(`   📄 Testing page ${pageNum}...`);
                const pageResp = await fetchDirect(pageUrl, { timeout: 5000 });
                console.log(`      ✅ Page ${pageNum}: ${pageResp.status} ${pageResp.statusText}`);
                
                if (pageResp.ok) {
                    const pageContent = await pageResp.text();
                    const hasContent = pageContent.includes('facsimile') || pageContent.includes('image');
                    console.log(`      📋 Has content: ${hasContent}`);
                }
            } catch (error) {
                console.log(`      ❌ Page ${pageNum}: ${error.message}`);
            }
        }
        
        console.log('\n✅ Test complete - check results above for patterns');
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        console.error(error.stack);
    }
}

testArenbergManifest().catch(console.error);