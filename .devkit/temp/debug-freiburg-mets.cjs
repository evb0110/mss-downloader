#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

async function followRedirects(url, maxRedirects = 5) {
    let currentUrl = url;
    let redirectCount = 0;
    
    while (redirectCount < maxRedirects) {
        console.log(`📡 Attempting to fetch: ${currentUrl}`);
        
        const response = await new Promise((resolve, reject) => {
            const parsedUrl = new URL(currentUrl);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/xml,text/xml,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                    'Cache-Control': 'no-cache'
                }
            };
            
            const req = https.request(options, resolve);
            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.end();
        });
        
        console.log(`📊 Response: ${response.statusCode} ${response.statusMessage}`);
        
        if (response.statusCode >= 300 && response.statusCode < 400) {
            // Handle redirect
            const location = response.headers.location;
            if (!location) {
                throw new Error(`Redirect without location header`);
            }
            
            // Resolve relative URLs
            currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
            console.log(`🔄 Redirecting to: ${currentUrl}`);
            redirectCount++;
            
            // Consume response body to prevent hanging
            response.on('data', () => {});
            response.on('end', () => {});
            
        } else if (response.statusCode >= 200 && response.statusCode < 300) {
            // Success - read the response
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            return new Promise((resolve) => {
                response.on('end', () => {
                    resolve({
                        url: currentUrl,
                        status: response.statusCode,
                        data: data,
                        headers: response.headers
                    });
                });
            });
            
        } else {
            throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
        }
    }
    
    throw new Error(`Too many redirects (${maxRedirects})`);
}

async function debugFreiburgMets() {
    console.log('🔍 Debugging Freiburg METS XML access...');
    
    const manuscriptId = 'hs360a';
    const possibleUrls = [
        `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets`,
        `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets.xml`,
        `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets/`,
        `https://dl.ub.uni-freiburg.de/mets/${manuscriptId}.xml`,
        `https://dl.ub.uni-freiburg.de/mets/${manuscriptId}`,
        `https://dl.ub.uni-freiburg.de/diglit/mets/${manuscriptId}.xml`
    ];
    
    console.log(`\n🧪 Testing ${possibleUrls.length} possible METS URLs...`);
    
    for (const url of possibleUrls) {
        try {
            console.log(`\n📋 Testing: ${url}`);
            const result = await followRedirects(url);
            
            console.log(`✅ Success! Final URL: ${result.url}`);
            console.log(`📄 Content type: ${result.headers['content-type'] || 'unknown'}`);
            console.log(`📏 Content length: ${result.data.length} characters`);
            
            // Check if it's XML
            if (result.data.includes('<?xml') && result.data.includes('mets')) {
                console.log(`🎯 FOUND VALID METS XML!`);
                
                // Extract some file information
                const fileMatches = result.data.match(/<mets:file[^>]*>[\s\S]*?<\/mets:file>/g) || [];
                console.log(`📁 Found ${fileMatches.length} file entries in METS`);
                
                // Look for image references
                const imageRefs = result.data.match(/\.jp[e]?g/gi) || [];
                console.log(`🖼️ Found ${imageRefs.length} image references`);
                
                // Save for analysis
                const fs = require('fs');
                const path = require('path');
                const outputFile = path.join(process.cwd(), '.devkit', 'temp', `freiburg-mets-${manuscriptId}.xml`);
                fs.writeFileSync(outputFile, result.data);
                console.log(`💾 METS XML saved to: ${outputFile}`);
                
                return {
                    success: true,
                    url: result.url,
                    finalUrl: result.url,
                    contentLength: result.data.length,
                    fileCount: fileMatches.length,
                    imageCount: imageRefs.length
                };
            }
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }
    
    console.log('\n❌ No valid METS XML found at any tested URL');
    return { success: false };
}

// Also test the main manuscript page to understand the structure
async function analyzeFreiburgStructure() {
    console.log('\n🔍 Analyzing Freiburg page structure...');
    
    const manuscriptId = 'hs360a';
    const mainUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
    
    try {
        const result = await followRedirects(mainUrl);
        console.log(`✅ Main page loaded: ${result.data.length} characters`);
        
        // Look for patterns that might indicate image locations
        const patterns = [
            /mets[^"'\s]*/gi,
            /\.jp[e]?g[^"'\s]*/gi,
            /iiif[^"'\s]*/gi,
            /diglitData[^"'\s]*/gi,
            /image[^"'\s]*/gi
        ];
        
        console.log('\n🔍 Searching for relevant patterns in main page:');
        
        patterns.forEach((pattern, index) => {
            const matches = result.data.match(pattern) || [];
            if (matches.length > 0) {
                console.log(`  Pattern ${index + 1}: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? '...' : ''}`);
            }
        });
        
        // Save page for manual analysis
        const fs = require('fs');
        const path = require('path');
        const outputFile = path.join(process.cwd(), '.devkit', 'temp', `freiburg-main-${manuscriptId}.html`);
        fs.writeFileSync(outputFile, result.data);
        console.log(`💾 Main page saved to: ${outputFile}`);
        
    } catch (error) {
        console.log(`❌ Failed to analyze main page: ${error.message}`);
    }
}

async function main() {
    await debugFreiburgMets();
    await analyzeFreiburgStructure();
}

main().catch(console.error);