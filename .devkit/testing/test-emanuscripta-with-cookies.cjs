#!/usr/bin/env node

/**
 * Fetch e-manuscripta pages with cookie support
 * Handles JavaScript verification and cookie requirements
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class EManuscriptaFetcher {
    constructor() {
        this.cookies = new Map();
    }
    
    setCookie(cookieString, domain) {
        // Parse cookie string
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
    
    fetchUrl(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    ...options.headers
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
                        this.setCookie(cookie, urlObj.hostname);
                    });
                }
                
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = res.headers.location.startsWith('http') 
                        ? res.headers.location 
                        : `https://${urlObj.hostname}${res.headers.location}`;
                    console.log(`  ↪️ Following redirect to: ${redirectUrl}`);
                    this.fetchUrl(redirectUrl, options).then(resolve).catch(reject);
                    return;
                }
                
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ 
                    ok: res.statusCode === 200, 
                    text: () => data, 
                    status: res.statusCode,
                    headers: res.headers 
                }));
            }).on('error', reject);
        });
    }
    
    async fetchWithJavaScriptCheck(url) {
        console.log('🍪 Step 1: Initial request to get JavaScript challenge...');
        
        // First request - will get the JavaScript check page
        let response = await this.fetchUrl(url);
        let html = await response.text();
        
        // Check if we got the JavaScript check page
        if (html.includes('js_enabled') && html.includes('js_check_beacon')) {
            console.log('  ✅ Got JavaScript check page');
            
            // Set the js_enabled cookie as the JavaScript would
            this.setCookie('js_enabled=1; path=/; SameSite=Lax', 'www.e-manuscripta.ch');
            console.log('  🍪 Set js_enabled cookie');
            
            // Make the second request with the cookie
            console.log('\n🔄 Step 2: Requesting with cookie...');
            response = await this.fetchUrl(url);
            html = await response.text();
            
            if (html.includes('js_enabled')) {
                console.log('  ⚠️ Still getting JavaScript check - may need session handling');
            } else {
                console.log('  ✅ Got actual page content!');
            }
        }
        
        return html;
    }
}

async function discoverPagesSimplified() {
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    const fetcher = new EManuscriptaFetcher();
    
    console.log('🔍 Fetching e-manuscripta page with cookie support...\n');
    
    const html = await fetcher.fetchWithJavaScriptCheck(testUrl);
    
    console.log(`\n📄 HTML size: ${html.length} bytes`);
    
    // Save HTML for inspection
    const outputPath = path.join(__dirname, 'emanuscripta-with-cookies.html');
    await fs.writeFile(outputPath, html, 'utf8');
    console.log(`💾 Saved HTML to: ${outputPath}`);
    
    // Check if we have a frameset
    if (html.includes('<frameset') || html.includes('<frame ')) {
        console.log('\n✅ Found frameset structure!');
        
        // Extract frame URLs
        const framePattern = /<frame[^>]*src=["']([^"']+)["'][^>]*name=["']([^"']+)["']/gi;
        let match;
        const frames = [];
        
        while ((match = framePattern.exec(html)) !== null) {
            frames.push({ url: match[1], name: match[2] });
        }
        
        console.log(`\n📍 Found ${frames.length} frames:`);
        frames.forEach(f => console.log(`  - ${f.name}: ${f.url}`));
        
        // Find the pageview frame
        const pageviewFrame = frames.find(f => f.url.includes('pageview'));
        
        if (pageviewFrame) {
            console.log(`\n🔄 Fetching pageview frame: ${pageviewFrame.url}`);
            
            const frameUrl = `https://www.e-manuscripta.ch${pageviewFrame.url}`;
            const frameHtml = await fetcher.fetchWithJavaScriptCheck(frameUrl);
            
            console.log(`📄 Frame HTML size: ${frameHtml.length} bytes`);
            
            // Save frame HTML
            const framePath = path.join(__dirname, 'emanuscripta-pageview-frame.html');
            await fs.writeFile(framePath, frameHtml, 'utf8');
            console.log(`💾 Saved frame HTML to: ${framePath}`);
            
            // Extract all option tags with page IDs
            const optionPattern = /<option\s+value="(\d+)"[^>]*>\[(\d+)\]\s*<\/option>/g;
            const pages = [];
            const pageMap = new Map();
            
            let optMatch;
            while ((optMatch = optionPattern.exec(frameHtml)) !== null) {
                const pageId = optMatch[1];
                const pageNumber = parseInt(optMatch[2]);
                
                if (!pageMap.has(pageId)) {
                    pageMap.set(pageId, pageNumber);
                    pages.push({
                        id: pageId,
                        number: pageNumber,
                        url: `https://www.e-manuscripta.ch/bau/content/zoom/${pageId}`,
                        downloadUrl: `https://www.e-manuscripta.ch/bau/download/webcache/2000/${pageId}`
                    });
                }
            }
            
            // Sort pages by page number
            pages.sort((a, b) => a.number - b.number);
            
            console.log(`\n✅ Found ${pages.length} pages from option tags!`);
            
            if (pages.length === 404) {
                console.log('🎉 SUCCESS: Found exactly 404 pages as expected!');
            }
            
            if (pages.length > 0) {
                console.log('\n📋 First 10 pages:');
                pages.slice(0, 10).forEach(p => {
                    console.log(`  Page ${String(p.number).padStart(3)}: ID ${p.id}`);
                });
                
                console.log('\n📋 Last 10 pages:');
                pages.slice(-10).forEach(p => {
                    console.log(`  Page ${String(p.number).padStart(3)}: ID ${p.id}`);
                });
                
                // Analyze page ID patterns
                console.log('\n📊 Page ID Analysis:');
                const gaps = new Map();
                
                for (let i = 1; i < pages.length; i++) {
                    const gap = parseInt(pages[i].id) - parseInt(pages[i-1].id);
                    if (!gaps.has(gap)) {
                        gaps.set(gap, []);
                    }
                    gaps.get(gap).push(i);
                }
                
                console.log(`  Unique gap sizes: ${gaps.size}`);
                for (const [gap, indices] of gaps) {
                    if (indices.length > 10) {
                        console.log(`    Gap of ${gap}: occurs ${indices.length} times`);
                    } else if (gap > 1) {
                        console.log(`    Gap of ${gap}: at positions ${indices.slice(0, 3).join(', ')}${indices.length > 3 ? '...' : ''}`);
                    }
                }
                
                // Create simplified manifest
                const manifest = {
                    url: testUrl,
                    totalPages: pages.length,
                    images: pages.map(p => ({
                        url: p.downloadUrl,
                        label: `Page ${p.number}`,
                        pageId: p.id
                    }))
                };
                
                console.log('\n📦 Generated simplified manifest:');
                console.log(`  Total pages: ${manifest.totalPages}`);
                console.log(`  Ready for download!`);
                
                // Save manifest for reference
                const manifestPath = path.join(__dirname, 'emanuscripta-simplified-manifest.json');
                await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
                console.log(`\n💾 Saved manifest to: ${manifestPath}`);
                
                return manifest;
            }
        }
    } else {
        console.log('\n⚠️ Did not find expected frameset structure');
        console.log('HTML preview:');
        console.log(html.substring(0, 500));
    }
}

// Run the discovery
(async () => {
    try {
        await discoverPagesSimplified();
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
})();