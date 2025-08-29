#!/usr/bin/env node

// Deep analysis of Arenberg page content to find image URLs
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
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function deepAnalyzeArenberg() {
    console.log('🔬 Deep analysis of Arenberg Gospels structure...\n');
    
    const baseUrl = 'https://www.themorgan.org/collection/arenberg-gospels';
    
    try {
        // Test page 1 in detail
        console.log('📄 Deep analysis of page 1...');
        const page1Url = `${baseUrl}/1`;
        const page1Resp = await fetchDirect(page1Url);
        
        if (page1Resp.ok) {
            const content = await page1Resp.text();
            
            // Look for ANY image patterns
            console.log('\n🔍 Image pattern search:');
            
            const allImageUrls = content.match(/https?:\/\/[^"'\s]*\.(jpg|jpeg|png|webp|zif|jp2|tiff?)/gi);
            console.log(`   🖼️  All image URLs: ${allImageUrls ? allImageUrls.length : 0}`);
            if (allImageUrls) {
                console.log('   📋 Samples:');
                allImageUrls.slice(0, 5).forEach(url => console.log(`      ${url}`));
            }
            
            // Look for data attributes
            const dataAttrs = content.match(/data-[^=]*="[^"]*"/g);
            console.log(`\n📊 Data attributes found: ${dataAttrs ? dataAttrs.length : 0}`);
            if (dataAttrs) {
                const uniqueDataAttrs = [...new Set(dataAttrs.map(attr => attr.split('=')[0]))];
                console.log('   📋 Unique data attributes:');
                uniqueDataAttrs.slice(0, 10).forEach(attr => console.log(`      ${attr}`));
            }
            
            // Look for JavaScript variables
            const scriptMatches = content.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
            console.log(`\n🔧 Script tags found: ${scriptMatches ? scriptMatches.length : 0}`);
            
            if (scriptMatches) {
                for (let i = 0; i < Math.min(3, scriptMatches.length); i++) {
                    const script = scriptMatches[i];
                    
                    // Look for image-related variables
                    const imageVars = script.match(/(zif|jpg|jpeg|image|facsimile)[^=]*=[^;]*/gi);
                    if (imageVars) {
                        console.log(`   🔧 Script ${i+1} image variables:`);
                        imageVars.slice(0, 3).forEach(v => console.log(`      ${v.slice(0, 100)}...`));
                    }
                }
            }
            
            // Look for class names that might indicate image containers
            const classMatches = content.match(/class="[^"]*image[^"]*"/gi);
            console.log(`\n🎨 Image-related classes: ${classMatches ? classMatches.length : 0}`);
            if (classMatches) {
                classMatches.slice(0, 5).forEach(cls => console.log(`   ${cls}`));
            }
            
        } else {
            console.log(`❌ Page 1 failed: ${page1Resp.status}`);
        }
        
        console.log('\n✅ Deep analysis complete');
        
    } catch (error) {
        console.error(`❌ Deep analysis failed: ${error.message}`);
    }
}

deepAnalyzeArenberg().catch(console.error);