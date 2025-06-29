// Morgan Library Debug Analysis Script
// Purpose: Analyze what images are actually being extracted from Morgan Library pages

import https from 'https';
import http from 'http';

async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function analyzeMorganPage(url) {
    console.log(`\n=== ANALYZING MORGAN LIBRARY URL ===`);
    console.log(`URL: ${url}\n`);
    
    try {
        const pageContent = await fetchPage(url);
        
        // Extract different types of image patterns found on the page
        console.log('=== IMAGE URL ANALYSIS ===\n');
        
        // 1. Styled images (thumbnails that need conversion)
        const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
        const styledMatches = pageContent.match(styledImageRegex) || [];
        
        console.log(`1. STYLED IMAGES (Thumbnails - ${styledMatches.length} found):`);
        styledMatches.slice(0, 3).forEach((match, i) => {
            const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
            const fullUrl = `https://www.themorgan.org${originalPath}`;
            console.log(`   ${i+1}. Styled: https://www.themorgan.org${match}`);
            console.log(`      High-res: ${fullUrl}`);
            console.log('');
        });
        
        // 2. Direct high-resolution images
        const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
        const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
        
        console.log(`2. DIRECT HIGH-RES IMAGES (${fullSizeMatches.length} found):`);
        fullSizeMatches.slice(0, 3).forEach((match, i) => {
            console.log(`   ${i+1}. https://www.themorgan.org${match}`);
        });
        
        // 3. Any other image references
        const allJpgRegex = /https?:\/\/[^"']*themorgan\.org[^"']*\.jpg/g;
        const allMatches = pageContent.match(allJpgRegex) || [];
        
        console.log(`\n3. ALL JPG REFERENCES (${allMatches.length} found):`);
        allMatches.slice(0, 5).forEach((match, i) => {
            console.log(`   ${i+1}. ${match}`);
        });
        
        // 4. Check what the current implementation would extract
        console.log(`\n=== CURRENT IMPLEMENTATION RESULT ===`);
        const pageLinks = [];
        
        // Add styled -> high-res conversions
        for (const match of styledMatches) {
            const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
            const fullUrl = `https://www.themorgan.org${originalPath}`;
            if (!pageLinks.includes(fullUrl)) {
                pageLinks.push(fullUrl);
            }
        }
        
        // Add direct high-res images
        for (const match of fullSizeMatches) {
            const fullUrl = `https://www.themorgan.org${match}`;
            if (!pageLinks.includes(fullUrl)) {
                pageLinks.push(fullUrl);
            }
        }
        
        // Add other themorgan.org jpg references with collection/facsimile paths
        for (const match of allMatches) {
            if (!pageLinks.includes(match) && (match.includes('facsimile') || match.includes('images/collection'))) {
                pageLinks.push(match);
            }
        }
        
        console.log(`Total images to be downloaded: ${pageLinks.length}`);
        console.log('\nFirst 5 URLs that would be downloaded:');
        pageLinks.slice(0, 5).forEach((url, i) => {
            console.log(`   ${i+1}. ${url}`);
        });
        
        // Test download one sample image to check size
        if (pageLinks.length > 0) {
            console.log(`\n=== TESTING SAMPLE IMAGE DOWNLOAD ===`);
            const sampleUrl = pageLinks[0];
            console.log(`Testing: ${sampleUrl}`);
            
            try {
                const response = await new Promise((resolve, reject) => {
                    https.get(sampleUrl, resolve).on('error', reject);
                });
                
                console.log(`Status: ${response.statusCode}`);
                console.log(`Content-Type: ${response.headers['content-type']}`);
                console.log(`Content-Length: ${response.headers['content-length']} bytes`);
                
                if (response.headers['content-length']) {
                    const sizeKB = Math.round(parseInt(response.headers['content-length']) / 1024);
                    console.log(`Size: ${sizeKB} KB`);
                    
                    if (sizeKB < 100) {
                        console.log('⚠️  WARNING: Image size is quite small - might be a thumbnail!');
                    } else {
                        console.log('✅ Image size looks good for high-resolution');
                    }
                }
                
                response.destroy(); // Don't download full content
                
            } catch (error) {
                console.log(`❌ Error testing image: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`Error analyzing page: ${error.message}`);
    }
}

// Test the URL from the TODO
const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
analyzeMorganPage(testUrl).then(() => {
    console.log('\n=== Testing with exact URL from TODO ===');
    const todoUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    if (todoUrl !== testUrl) {
        return analyzeMorganPage(todoUrl);
    } else {
        console.log('Same URL as already tested above.');
    }
});