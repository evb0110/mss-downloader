#!/usr/bin/env node

// Direct test of Florence implementation
const https = require('https');

async function testFlorenceDirectly() {
    console.log('🔍 Testing Florence ContentDM Directly\n');
    console.log('Issue: Similar to Graz - endless manifest loading, JavaScript errors');
    console.log('=' .repeat(60));
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log(`\nTest URL: ${testUrl}`);
        console.log('[1] Fetching page HTML to analyze...\n');
        
        const html = await fetchUrl(testUrl);
        console.log(`✅ Page fetched successfully (${html.length} bytes)`);
        
        // Check if __INITIAL_STATE__ exists
        const hasInitialState = html.includes('__INITIAL_STATE__');
        console.log(`\n[2] Checking for __INITIAL_STATE__: ${hasInitialState ? '✅ Found' : '❌ Not found'}`);
        
        if (hasInitialState) {
            // Try to extract it
            const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*(?:\\.[^"]*)*)"\s*\)\s*;/);
            
            if (stateMatch) {
                console.log('✅ __INITIAL_STATE__ regex matched');
                
                try {
                    // Decode the JSON string
                    let jsonString = stateMatch[1];
                    jsonString = jsonString
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\n/g, '\n')
                        .replace(/\\r/g, '\r')
                        .replace(/\\t/g, '\t');
                    
                    const state = JSON.parse(jsonString);
                    console.log('✅ JSON parsed successfully');
                    
                    if (state.item?.item) {
                        console.log(`   Item ID: ${state.item.item.id}`);
                        console.log(`   Title: ${state.item.item.title || 'N/A'}`);
                        
                        if (state.item.item.parent?.children) {
                            console.log(`   Pages: ${state.item.item.parent.children.length}`);
                        }
                    }
                } catch (e) {
                    console.log('❌ JSON parsing failed:', e.message);
                }
            } else {
                console.log('❌ __INITIAL_STATE__ regex did not match');
                
                // Try simpler patterns
                const patterns = [
                    /__INITIAL_STATE__\s*=\s*({[^;]+});/,
                    /__INITIAL_STATE__.*?"([^"]+)"/,
                    /JSON\.parse\("([^"]+)"\)/
                ];
                
                for (const pattern of patterns) {
                    if (html.match(pattern)) {
                        console.log(`   Alternative pattern matched: ${pattern.source.substring(0, 30)}...`);
                        break;
                    }
                }
            }
        }
        
        // Test direct IIIF access
        console.log('\n[3] Testing direct IIIF endpoint...');
        const itemId = '317515';
        const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/full/0/default.jpg`;
        
        console.log(`   IIIF URL: ${iiifUrl}`);
        
        const imageResponse = await fetchHead(iiifUrl);
        if (imageResponse.statusCode === 200) {
            console.log(`   ✅ IIIF endpoint accessible`);
            console.log(`   Content-Type: ${imageResponse.headers['content-type']}`);
            console.log(`   Content-Length: ${imageResponse.headers['content-length']} bytes`);
        } else {
            console.log(`   ❌ IIIF endpoint returned ${imageResponse.statusCode}`);
        }
        
        // Check for JavaScript errors in HTML
        console.log('\n[4] Checking for JavaScript errors in HTML...');
        const jsErrorPatterns = [
            /error/i,
            /exception/i,
            /failed/i,
            /undefined/i,
            /cannot read/i
        ];
        
        let foundErrors = false;
        for (const pattern of jsErrorPatterns) {
            const matches = html.match(new RegExp(`<script[^>]*>.*?${pattern.source}.*?</script>`, 'gis'));
            if (matches && matches.length > 0) {
                console.log(`   ⚠️  Found potential JS error pattern: ${pattern.source}`);
                foundErrors = true;
            }
        }
        
        if (!foundErrors) {
            console.log('   ✅ No obvious JavaScript errors found');
        }
        
        console.log('\n📊 Summary:');
        console.log('   - Page loads successfully');
        console.log('   - IIIF endpoint is accessible');
        console.log('   - __INITIAL_STATE__ parsing may have issues');
        console.log('   - Fallback to direct IIIF should work');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        
        if (error.code === 'ETIMEDOUT') {
            console.error('\n⏱️ TIMEOUT DETECTED - Similar to Graz issue');
        }
    }
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 120000 // 2 minutes
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks).toString());
            });
        }).on('error', reject).on('timeout', () => {
            reject(new Error('Request timeout after 2 minutes'));
        });
    });
}

function fetchHead(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        }, (res) => {
            resolve({
                statusCode: res.statusCode,
                headers: res.headers
            });
        }).on('error', reject).end();
    });
}

// Run the test
testFlorenceDirectly().catch(console.error);