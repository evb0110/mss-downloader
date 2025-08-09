#!/usr/bin/env node

/**
 * Fetch and properly decompress e-manuscripta HTML
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs').promises;
const path = require('path');

function fetchUrl(url, followRedirects = true) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
                // Don't set Accept-Encoding to avoid compression
            }
        };
        
        https.get(options, (res) => {
            if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : `https://${urlObj.hostname}${res.headers.location}`;
                console.log(`  ↪️ Following redirect to: ${redirectUrl}`);
                fetchUrl(redirectUrl, true).then(resolve).catch(reject);
                return;
            }
            
            let data = '';
            res.setEncoding('utf8'); // Ensure proper text encoding
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

async function analyzeHTML() {
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    console.log('🔍 Fetching HTML from:', testUrl);
    
    const response = await fetchUrl(testUrl);
    console.log(`📊 Response status: ${response.status}`);
    
    const html = await response.text();
    console.log(`📄 HTML size: ${html.length} bytes`);
    
    // Save HTML for inspection
    const outputPath = path.join(__dirname, 'emanuscripta-uncompressed.html');
    await fs.writeFile(outputPath, html, 'utf8');
    console.log(`💾 Saved HTML to: ${outputPath}`);
    
    // Check what we actually got
    console.log('\n📋 HTML Preview (first 500 chars):');
    console.log(html.substring(0, 500));
    
    // Check if it's a frameset
    if (html.includes('<frameset') || html.includes('<iframe')) {
        console.log('\n✅ Found frames in the HTML!');
        
        // Extract frame URLs
        const framePattern = /<(?:frame|iframe)[^>]*src=["']([^"']+)["']/gi;
        let match;
        const frames = [];
        
        while ((match = framePattern.exec(html)) !== null) {
            frames.push(match[1]);
        }
        
        console.log(`\n📍 Found ${frames.length} frame(s):`);
        
        for (const frameUrl of frames) {
            console.log(`\n🔄 Fetching frame: ${frameUrl}`);
            
            // Make absolute URL
            const absoluteFrameUrl = frameUrl.startsWith('http') 
                ? frameUrl 
                : `https://www.e-manuscripta.ch${frameUrl.startsWith('/') ? '' : '/'}${frameUrl}`;
            
            console.log(`  Full URL: ${absoluteFrameUrl}`);
            
            const frameResponse = await fetchUrl(absoluteFrameUrl);
            const frameHtml = await frameResponse.text();
            
            console.log(`  📄 Frame HTML size: ${frameHtml.length} bytes`);
            
            // Save frame HTML
            const frameName = frameUrl.includes('pageview') ? 'pageview' : 'other';
            const framePath = path.join(__dirname, `emanuscripta-frame-${frameName}.html`);
            await fs.writeFile(framePath, frameHtml, 'utf8');
            console.log(`  💾 Saved to: ${framePath}`);
            
            // Analyze frame for option tags
            const optionPattern = /<option[^>]*value=["'](\d+)["'][^>]*>\[?(\d+)\]?[^<]*<\/option>/g;
            const pageIds = [];
            let optMatch;
            
            while ((optMatch = optionPattern.exec(frameHtml)) !== null) {
                pageIds.push({ 
                    id: optMatch[1], 
                    number: parseInt(optMatch[2] || optMatch[1])
                });
            }
            
            if (pageIds.length > 0) {
                console.log(`  ✅ Found ${pageIds.length} pages in this frame!`);
                
                if (pageIds.length === 404) {
                    console.log('  🎉 SUCCESS: Found exactly 404 pages as expected!');
                }
                
                console.log('\n  First 5 pages:');
                pageIds.slice(0, 5).forEach(p => console.log(`    Page ${p.number}: ID ${p.id}`));
                
                console.log('\n  Last 5 pages:');
                pageIds.slice(-5).forEach(p => console.log(`    Page ${p.number}: ID ${p.id}`));
                
                // Analyze page ID patterns
                const gaps = [];
                for (let i = 1; i < pageIds.length; i++) {
                    const gap = parseInt(pageIds[i].id) - parseInt(pageIds[i-1].id);
                    if (gap !== 1 && !gaps.some(g => g.size === gap)) {
                        gaps.push({ size: gap, count: 1 });
                    } else if (gap !== 1) {
                        gaps.find(g => g.size === gap).count++;
                    }
                }
                
                if (gaps.length > 0) {
                    console.log('\n  📊 Page ID gap patterns:');
                    gaps.forEach(g => console.log(`    Gap of ${g.size}: occurs ${g.count} times`));
                }
            } else {
                console.log('  ℹ️ No option tags found in this frame');
            }
        }
    } else {
        console.log('\n⚠️ No frames found in the HTML');
        console.log('The page might be loading content dynamically via JavaScript');
    }
}

// Run the analysis
(async () => {
    try {
        await analyzeHTML();
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
})();