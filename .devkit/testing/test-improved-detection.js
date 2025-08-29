#!/usr/bin/env node

// Test the improved image detection logic
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
            }
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data)
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function testImprovedDetection() {
    console.log('🧪 Testing improved image detection for Arenberg...\n');
    
    const baseUrl = 'https://www.themorgan.org';
    const manuscriptId = 'arenberg-gospels';
    const samplePageUrl = `${baseUrl}/collection/${manuscriptId}/1`;
    
    try {
        console.log(`📄 Fetching: ${samplePageUrl}`);
        const sampleResponse = await fetchDirect(samplePageUrl);
        
        if (sampleResponse.ok) {
            const sampleContent = await sampleResponse.text();
            
            // Apply the exact logic from MorganLoader fix
            const actualZifUrls = sampleContent.match(/https?:\/\/host\.themorgan\.org\/facsimile\/images\/[^"'\s]+\.zif/g);
            const actualJpegUrls = sampleContent.match(/https?:\/\/[^"'\s]*themorgan\.org\/sites\/default\/files[^"'\s]*facsimile[^"'\s]*\.jpg/g);
            const facsimileUrls = sampleContent.match(/\/sites\/default\/files\/(?:styles\/[^"']*\/public\/)?facsimile\/[^"']+\.jpg/g);
            
            console.log('🔍 Improved detection results:');
            console.log(`   🔍 ZIF URLs: ${actualZifUrls ? actualZifUrls.length : 0}`);
            console.log(`   📸 JPEG URLs: ${actualJpegUrls ? actualJpegUrls.length : 0}`);
            console.log(`   📋 Facsimile URLs: ${facsimileUrls ? facsimileUrls.length : 0}`);
            
            if (actualZifUrls) actualZifUrls.forEach(url => console.log(`      ZIF: ${url}`));
            if (actualJpegUrls) actualJpegUrls.forEach(url => console.log(`      JPEG: ${url}`));
            if (facsimileUrls) facsimileUrls.forEach(url => console.log(`      Facsimile: ${url}`));
            
            const hasActualImages = (actualZifUrls && actualZifUrls.length > 0) || 
                                   (actualJpegUrls && actualJpegUrls.length > 0) || 
                                   (facsimileUrls && facsimileUrls.length > 0);
            
            console.log(`\n📊 FINAL RESULT: ${hasActualImages ? '✅ HAS ACTUAL IMAGES' : '❌ NO ACTUAL IMAGES'}`);
            
            if (!hasActualImages) {
                console.log('\n🎯 SUCCESS: Arenberg will now be properly rejected');
                console.log('   This prevents infinite hanging in robust discovery');
            }
            
        } else {
            console.log(`❌ Failed to fetch sample page: ${sampleResponse.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
}

testImprovedDetection().catch(console.error);