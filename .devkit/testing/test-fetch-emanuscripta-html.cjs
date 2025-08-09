#!/usr/bin/env node

/**
 * Fetch and analyze e-manuscripta HTML to understand page structure
 */

const https = require('https');
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
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
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
    console.log(`📋 Response headers:`, response.headers);
    
    const html = await response.text();
    console.log(`📄 HTML size: ${html.length} bytes`);
    
    // Save HTML for inspection
    const outputPath = path.join(__dirname, 'emanuscripta-page.html');
    await fs.writeFile(outputPath, html, 'utf8');
    console.log(`💾 Saved HTML to: ${outputPath}`);
    
    // Analyze HTML structure
    console.log('\n📊 HTML Analysis:');
    console.log('-'.repeat(50));
    
    // Check for option tags
    const optionMatches = html.match(/<option[^>]*>/g);
    console.log(`Option tags found: ${optionMatches ? optionMatches.length : 0}`);
    
    if (optionMatches) {
        console.log('\n🔍 Sample option tags:');
        optionMatches.slice(0, 5).forEach(opt => console.log(`  ${opt}`));
    }
    
    // Check for select tags
    const selectMatches = html.match(/<select[^>]*>/g);
    console.log(`\nSelect tags found: ${selectMatches ? selectMatches.length : 0}`);
    
    if (selectMatches) {
        console.log('\n🔍 Select tags:');
        selectMatches.forEach(sel => console.log(`  ${sel}`));
    }
    
    // Check for iframes (content might be in iframe)
    const iframeMatches = html.match(/<iframe[^>]*>/g);
    console.log(`\niFrame tags found: ${iframeMatches ? iframeMatches.length : 0}`);
    
    if (iframeMatches) {
        console.log('\n🔍 iFrame sources:');
        iframeMatches.forEach(iframe => {
            const srcMatch = iframe.match(/src=["']([^"']+)["']/);
            if (srcMatch) console.log(`  ${srcMatch[1]}`);
        });
    }
    
    // Check for JavaScript variables that might contain page data
    console.log('\n🔍 JavaScript variables:');
    const jsVars = [
        'totalPages', 'pageCount', 'numPages', 'lastPage',
        'pages', 'manifest', 'viewer', 'config'
    ];
    
    jsVars.forEach(varName => {
        const regex = new RegExp(`${varName}[\\s:=]+(\\d+|\\[.*?\\]|\\{.*?\\})`, 'i');
        const match = html.match(regex);
        if (match) {
            console.log(`  Found ${varName}: ${match[1].substring(0, 100)}...`);
        }
    });
    
    // Check for AJAX endpoints
    console.log('\n🔍 Potential AJAX/API endpoints:');
    const urlPatterns = [
        /["']([^"']*\/api\/[^"']+)["']/g,
        /["']([^"']*\/service\/[^"']+)["']/g,
        /["']([^"']*\/json[^"']+)["']/g,
        /["']([^"']*\/manifest[^"']+)["']/g,
        /["']([^"']*\/getPages[^"']+)["']/g,
        /["']([^"']*\/viewer[^"']+)["']/g
    ];
    
    const foundEndpoints = new Set();
    urlPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            foundEndpoints.add(match[1]);
        }
    });
    
    if (foundEndpoints.size > 0) {
        Array.from(foundEndpoints).forEach(endpoint => {
            console.log(`  ${endpoint}`);
        });
    }
    
    // Check for viewer initialization
    console.log('\n🔍 Viewer initialization:');
    const viewerPatterns = [
        /new\s+(\w+Viewer)\s*\(/g,
        /\.init\s*\([^)]*\)/g,
        /viewer\s*=\s*[^;]+/g
    ];
    
    viewerPatterns.forEach(pattern => {
        const matches = html.match(pattern);
        if (matches) {
            matches.slice(0, 3).forEach(match => {
                console.log(`  ${match.substring(0, 100)}`);
            });
        }
    });
    
    // Try to find the actual page content container
    console.log('\n🔍 Looking for page navigation elements:');
    
    // Look for any navigation-related elements
    const navPatterns = [
        /<div[^>]*class=["'][^"']*nav[^"']*["'][^>]*>/gi,
        /<div[^>]*class=["'][^"']*page[^"']*["'][^>]*>/gi,
        /<input[^>]*type=["']number["'][^>]*>/gi,
        /<button[^>]*>[^<]*page[^<]*<\/button>/gi
    ];
    
    navPatterns.forEach(pattern => {
        const matches = html.match(pattern);
        if (matches) {
            console.log(`  Found ${matches.length} elements matching ${pattern.source}`);
            matches.slice(0, 2).forEach(m => console.log(`    ${m}`));
        }
    });
    
    // Extract the viewer frame URL if it exists
    console.log('\n🔍 Checking for embedded viewer frame:');
    const framePattern = /<iframe[^>]*src=["']([^"']+)["']/i;
    const frameMatch = html.match(framePattern);
    
    if (frameMatch) {
        const frameUrl = frameMatch[1];
        console.log(`\n📍 Found viewer frame URL: ${frameUrl}`);
        
        // If it's a relative URL, make it absolute
        const absoluteFrameUrl = frameUrl.startsWith('http') 
            ? frameUrl 
            : `https://www.e-manuscripta.ch${frameUrl.startsWith('/') ? '' : '/'}${frameUrl}`;
        
        console.log(`\n🔄 Fetching frame content from: ${absoluteFrameUrl}`);
        
        const frameResponse = await fetchUrl(absoluteFrameUrl);
        const frameHtml = await frameResponse.text();
        
        console.log(`📄 Frame HTML size: ${frameHtml.length} bytes`);
        
        // Save frame HTML
        const framePath = path.join(__dirname, 'emanuscripta-frame.html');
        await fs.writeFile(framePath, frameHtml, 'utf8');
        console.log(`💾 Saved frame HTML to: ${framePath}`);
        
        // Analyze frame for option tags
        const frameOptions = frameHtml.match(/<option[^>]*value=["'](\d+)["'][^>]*>\[(\d+)\][^<]*<\/option>/g);
        if (frameOptions) {
            console.log(`\n✅ Found ${frameOptions.length} option tags in frame!`);
            console.log('Sample options:');
            frameOptions.slice(0, 5).forEach(opt => console.log(`  ${opt}`));
            
            // Extract all page IDs
            const pageIds = [];
            const optionPattern = /<option[^>]*value=["'](\d+)["'][^>]*>\[(\d+)\][^<]*<\/option>/g;
            let match;
            while ((match = optionPattern.exec(frameHtml)) !== null) {
                pageIds.push({ id: match[1], number: parseInt(match[2]) });
            }
            
            console.log(`\n📊 Extracted ${pageIds.length} page IDs`);
            if (pageIds.length === 404) {
                console.log('✅ SUCCESS: Found exactly 404 pages as expected!');
            }
            
            console.log('\nFirst 5 pages:');
            pageIds.slice(0, 5).forEach(p => console.log(`  Page ${p.number}: ID ${p.id}`));
            
            console.log('\nLast 5 pages:');
            pageIds.slice(-5).forEach(p => console.log(`  Page ${p.number}: ID ${p.id}`));
        }
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