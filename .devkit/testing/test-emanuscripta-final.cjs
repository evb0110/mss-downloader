#!/usr/bin/env node

/**
 * Final simplified e-manuscripta page discovery
 * Extracts all pages directly from HTML with cookie support
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class EManuscriptaSimplified {
    constructor() {
        this.cookies = new Map();
    }
    
    setCookie(cookieString) {
        const parts = cookieString.split(';').map(p => p.trim());
        const [name, value] = parts[0].split('=');
        this.cookies.set(name, value);
    }
    
    getCookieHeader() {
        const cookies = [];
        for (const [name, value] of this.cookies) {
            cookies.push(`${name}=${value}`);
        }
        return cookies.join('; ');
    }
    
    fetchUrl(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            };
            
            // Add cookies if we have any
            const cookieHeader = this.getCookieHeader();
            if (cookieHeader) {
                requestOptions.headers['Cookie'] = cookieHeader;
            }
            
            https.get(requestOptions, (res) => {
                // Handle set-cookie headers
                if (res.headers['set-cookie']) {
                    res.headers['set-cookie'].forEach(cookie => {
                        this.setCookie(cookie);
                    });
                }
                
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = res.headers.location.startsWith('http') 
                        ? res.headers.location 
                        : `https://${urlObj.hostname}${res.headers.location}`;
                    this.fetchUrl(redirectUrl).then(resolve).catch(reject);
                    return;
                }
                
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ 
                    ok: res.statusCode === 200, 
                    text: () => data, 
                    status: res.statusCode
                }));
            }).on('error', reject);
        });
    }
    
    async getManifest(url) {
        console.log('🔍 Fetching e-manuscripta page...');
        
        // Extract library from URL
        const match = url.match(/e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/);
        if (!match) {
            throw new Error('Invalid URL format');
        }
        
        const [, library, viewType, manuscriptId] = match;
        console.log(`📚 Library: ${library}, View: ${viewType}, Base ID: ${manuscriptId}`);
        
        // First request - might get JavaScript check
        let response = await this.fetchUrl(url);
        let html = await response.text();
        
        // Handle JavaScript check if present
        if (html.includes('js_enabled') && html.includes('js_check_beacon')) {
            console.log('  🍪 Handling JavaScript verification...');
            this.setCookie('js_enabled=1; path=/; SameSite=Lax');
            response = await this.fetchUrl(url);
            html = await response.text();
        }
        
        console.log(`📄 Fetched ${html.length} bytes of HTML`);
        
        // Extract title
        let displayName = `e-manuscripta ${library} ${manuscriptId}`;
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            displayName = titleMatch[1].trim();
        }
        
        // Extract all pages from option tags
        // Pattern: <option value="5157223">[3] </option>
        // Some pages may have duplicates with different IDs pointing to same page number
        const optionPattern = /<option\s+value="(\d+)"[^>]*>\[(\d+)\]\s*<\/option>/g;
        const pagesByNumber = new Map(); // Group by page number to handle duplicates
        
        let match2;
        while ((match2 = optionPattern.exec(html)) !== null) {
            const pageId = match2[1];
            const pageNumber = parseInt(match2[2]);
            
            // Keep the first ID for each page number (or could keep all as alternatives)
            if (!pagesByNumber.has(pageNumber)) {
                pagesByNumber.set(pageNumber, {
                    id: pageId,
                    number: pageNumber,
                    url: `https://www.e-manuscripta.ch/${library}/content/zoom/${pageId}`,
                    downloadUrl: `https://www.e-manuscripta.ch/${library}/download/webcache/2000/${pageId}`
                });
            }
        }
        
        // Convert to sorted array
        const pages = Array.from(pagesByNumber.values()).sort((a, b) => a.number - b.number);
        
        console.log(`\n✅ Found ${pages.length} unique pages from HTML option tags`);
        
        if (pages.length === 404) {
            console.log('🎉 SUCCESS: Found exactly 404 pages as expected!');
        } else if (pages.length > 400) {
            console.log(`📊 Found ${pages.length} pages (close to expected 404)`);
        }
        
        // Create manifest in the format expected by the app
        const images = pages.map(p => ({
            url: p.downloadUrl,
            label: `Page ${p.number}`,
            blockId: p.id  // Keep the page ID for reference
        }));
        
        return {
            images,
            displayName,
            totalPages: pages.length,
            library,
            manuscriptId
        };
    }
}

async function testSimplifiedDiscovery() {
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    const loader = new EManuscriptaSimplified();
    
    console.log('='.repeat(80));
    console.log('🚀 SIMPLIFIED E-MANUSCRIPTA DISCOVERY');
    console.log('='.repeat(80));
    console.log();
    
    try {
        const startTime = Date.now();
        const manifest = await loader.getManifest(testUrl);
        const elapsed = Date.now() - startTime;
        
        console.log('\n📋 Manifest Summary:');
        console.log(`  Title: ${manifest.displayName}`);
        console.log(`  Total Pages: ${manifest.totalPages}`);
        console.log(`  Time taken: ${elapsed}ms`);
        
        // Show sample pages
        console.log('\n📄 First 5 pages:');
        manifest.images.slice(0, 5).forEach(img => {
            console.log(`  ${img.label}: ${img.blockId}`);
        });
        
        console.log('\n📄 Last 5 pages:');
        manifest.images.slice(-5).forEach(img => {
            console.log(`  ${img.label}: ${img.blockId}`);
        });
        
        // Compare with current implementation
        console.log('\n' + '='.repeat(80));
        console.log('🆚 COMPARISON WITH CURRENT IMPLEMENTATION');
        console.log('='.repeat(80));
        
        const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
        const currentLoader = new SharedManifestLoaders();
        
        const currentStart = Date.now();
        const currentResult = await currentLoader.getEManuscriptaManifest(testUrl);
        const currentElapsed = Date.now() - currentStart;
        
        console.log('\n📊 Performance Comparison:');
        console.log(`  Simplified: ${elapsed}ms for ${manifest.totalPages} pages`);
        console.log(`  Current: ${currentElapsed}ms for ${currentResult.images.length} pages`);
        console.log(`  Speed improvement: ${Math.round(currentElapsed / elapsed)}x faster`);
        console.log(`  Page difference: ${Math.abs(manifest.totalPages - currentResult.images.length)} pages`);
        
        if (manifest.totalPages > currentResult.images.length) {
            console.log(`\n✅ Simplified method finds ${manifest.totalPages - currentResult.images.length} MORE pages!`);
        }
        
        // Save manifest for testing
        const outputPath = path.join(__dirname, 'emanuscripta-simplified-manifest.json');
        await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
        console.log(`\n💾 Saved manifest to: ${outputPath}`);
        
        // Test downloading a sample page to verify URLs work
        console.log('\n🔍 Verifying download URLs (testing 3 random pages)...');
        const sampleIndices = [0, Math.floor(manifest.images.length / 2), manifest.images.length - 1];
        
        for (const idx of sampleIndices) {
            const image = manifest.images[idx];
            const response = await loader.fetchUrl(image.url);
            const content = await response.text();
            const isImage = content.startsWith('\xFF\xD8') || content.startsWith('\x89PNG');
            console.log(`  ${image.label}: ${response.ok ? '✅' : '❌'} ${response.status} (${isImage ? 'Valid image' : 'Check content'})`);
        }
        
        return manifest;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Export for use in production
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EManuscriptaSimplified };
}

// Run test if executed directly
if (require.main === module) {
    testSimplifiedDiscovery();
}