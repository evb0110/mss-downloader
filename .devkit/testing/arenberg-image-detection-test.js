#!/usr/bin/env node

// Test the image detection logic for Arenberg Gospels
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

async function testImageDetection() {
    console.log('🔍 Testing Arenberg image detection logic...\n');
    
    const baseUrl = 'https://www.themorgan.org';
    const manuscriptId = 'arenberg-gospels';
    const samplePageUrl = `${baseUrl}/collection/${manuscriptId}/1`;
    
    console.log(`📄 Testing sample page: ${samplePageUrl}`);
    
    try {
        const sampleResponse = await fetchDirect(samplePageUrl);
        console.log(`✅ Response: ${sampleResponse.status}`);
        
        if (sampleResponse.ok) {
            const sampleContent = await sampleResponse.text();
            console.log(`📄 Content length: ${sampleContent.length}`);
            
            // Apply the same logic as MorganLoader
            const hasFacsimile = sampleContent.includes('facsimile');
            const hasJpg = sampleContent.includes('.jpg');
            const hasZif = sampleContent.includes('.zif');
            const hasMorganHost = sampleContent.includes('host.themorgan.org');
            
            console.log('\n🔍 Image detection results:');
            console.log(`   📋 Contains 'facsimile': ${hasFacsimile}`);
            console.log(`   🖼️  Contains '.jpg': ${hasJpg}`);
            console.log(`   🔍 Contains '.zif': ${hasZif}`);
            console.log(`   🌐 Contains 'host.themorgan.org': ${hasMorganHost}`);
            
            const hasImages = hasFacsimile && (hasJpg || hasZif || hasMorganHost);
            console.log(`\n📊 Final detection result: ${hasImages ? '✅ HAS IMAGES' : '❌ NO IMAGES'}`);
            
            if (!hasImages) {
                console.log('\n🎯 CONCLUSION: Arenberg should be rejected with proper error message');
                console.log('   The manuscript appears to not be digitized or uses dynamic loading');
            } else {
                console.log('\n⚠️  WARNING: Detection logic needs refinement');
            }
            
        } else {
            console.log(`❌ Sample page failed: ${sampleResponse.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
}

testImageDetection().catch(console.error);