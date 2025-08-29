#!/usr/bin/env node

// Analyze Arenberg page content to understand structure
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
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function analyzeArenberg() {
    console.log('🔍 Analyzing Arenberg Gospels structure...\n');
    
    try {
        // Test main page
        console.log('1️⃣ Analyzing main page structure...');
        const mainUrl = 'https://www.themorgan.org/collection/arenberg-gospels';
        const mainResp = await fetchDirect(mainUrl);
        const mainContent = await mainResp.text();
        
        console.log(`📄 Main page content length: ${mainContent.length}`);
        
        // Look for ZIF patterns
        const zifMatches = mainContent.match(/host\.themorgan\.org\/facsimile\/images\/[^"'\s]+\.zif/g);
        console.log(`🔍 ZIF URLs found: ${zifMatches ? zifMatches.length : 0}`);
        if (zifMatches) {
            console.log(`   First ZIF: ${zifMatches[0]}`);
        }
        
        // Look for JPEG patterns  
        const jpegMatches = mainContent.match(/themorgan\.org\/sites\/default\/files[^"'\s]+\.jpg/g);
        console.log(`📸 JPEG URLs found: ${jpegMatches ? jpegMatches.length : 0}`);
        if (jpegMatches) {
            console.log(`   First JPEG: ${jpegMatches[0]}`);
        }
        
        // Look for page navigation
        const pageLinks = mainContent.match(/\/collection\/arenberg-gospels\/\d+/g);
        console.log(`🔗 Page links found: ${pageLinks ? pageLinks.length : 0}`);
        if (pageLinks) {
            const uniquePages = [...new Set(pageLinks)].sort();
            console.log(`   Unique pages: ${uniquePages.slice(0, 10).join(', ')}${uniquePages.length > 10 ? '...' : ''}`);
        }
        
        // Test a few individual pages
        console.log('\n2️⃣ Testing individual pages...');
        const testPages = [1, 10, 15];
        
        for (const pageNum of testPages) {
            try {
                console.log(`\n   📄 Analyzing page ${pageNum}...`);
                const pageUrl = `${mainUrl}/${pageNum}`;
                const pageResp = await fetchDirect(pageUrl);
                
                if (pageResp.ok) {
                    const pageContent = await pageResp.text();
                    console.log(`      📄 Content length: ${pageContent.length}`);
                    
                    // Look for images in individual page
                    const pageZifs = pageContent.match(/host\.themorgan\.org\/facsimile\/images\/[^"'\s]+\.zif/g);
                    const pageJpegs = pageContent.match(/themorgan\.org\/sites\/default\/files[^"'\s]+\.jpg/g);
                    
                    console.log(`      🔍 ZIFs: ${pageZifs ? pageZifs.length : 0}`);
                    console.log(`      📸 JPEGs: ${pageJpegs ? pageJpegs.length : 0}`);
                    
                    if (pageZifs) {
                        console.log(`      📋 ZIF sample: ${pageZifs[0]}`);
                    }
                    if (pageJpegs) {
                        console.log(`      📋 JPEG sample: ${pageJpegs[0]}`);
                    }
                } else {
                    console.log(`      ❌ Failed: ${pageResp.status}`);
                }
            } catch (error) {
                console.log(`      ❌ Error: ${error.message}`);
            }
        }
        
        console.log('\n✅ Analysis complete');
        
    } catch (error) {
        console.error(`❌ Analysis failed: ${error.message}`);
    }
}

analyzeArenberg().catch(console.error);