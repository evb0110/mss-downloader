#!/usr/bin/env node

/**
 * Test simplified e-manuscripta page discovery
 * Extract all pages directly from HTML option tags
 */

const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode === 200, text: () => data, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function discoverPagesFromHTML(url) {
    console.log('🔍 Fetching HTML from:', url);
    
    // Extract library and manuscript ID from URL
    const match = url.match(/e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/);
    if (!match) {
        throw new Error('Invalid URL format');
    }
    
    const [, library, viewType, manuscriptId] = match;
    console.log(`📚 Library: ${library}, View: ${viewType}, Base ID: ${manuscriptId}`);
    
    // Fetch the HTML page
    const response = await fetchUrl(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`📄 Fetched HTML (${html.length} bytes)`);
    
    // Extract all option values from the page selector
    // Pattern: <option value="5157223">[3] </option>
    const optionPattern = /<option\s+value="(\d+)"[^>]*>\[(\d+)\]\s*<\/option>/g;
    const pages = [];
    const pageMap = new Map(); // Track unique pages
    
    let match2;
    while ((match2 = optionPattern.exec(html)) !== null) {
        const pageId = match2[1];
        const pageNumber = parseInt(match2[2]);
        
        if (!pageMap.has(pageId)) {
            pageMap.set(pageId, pageNumber);
            pages.push({
                id: pageId,
                number: pageNumber,
                url: `https://www.e-manuscripta.ch/${library}/content/zoom/${pageId}`,
                downloadUrl: `https://www.e-manuscripta.ch/${library}/download/webcache/2000/${pageId}`
            });
        }
    }
    
    // Sort pages by page number to ensure correct order
    pages.sort((a, b) => a.number - b.number);
    
    console.log(`\n✅ Found ${pages.length} unique pages from HTML`);
    
    // Show first and last few pages for verification
    if (pages.length > 0) {
        console.log('\n📋 First 5 pages:');
        pages.slice(0, 5).forEach(p => {
            console.log(`  Page ${p.number}: ID ${p.id}`);
        });
        
        if (pages.length > 10) {
            console.log('\n📋 Last 5 pages:');
            pages.slice(-5).forEach(p => {
                console.log(`  Page ${p.number}: ID ${p.id}`);
            });
        }
    }
    
    return pages;
}

async function compareWithCurrentImplementation() {
    console.log('\n' + '='.repeat(80));
    console.log('🆚 COMPARISON: Simple HTML extraction vs Complex block discovery');
    console.log('='.repeat(80) + '\n');
    
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/zoom/5157616';
    
    try {
        // 1. Simple HTML extraction
        console.log('📊 METHOD 1: Simple HTML extraction');
        console.log('-'.repeat(40));
        const simplePagesStart = Date.now();
        const simplePages = await discoverPagesFromHTML(testUrl);
        const simpleTime = Date.now() - simplePagesStart;
        
        console.log(`⏱️  Time taken: ${simpleTime}ms`);
        console.log(`📄 Pages found: ${simplePages.length}`);
        console.log(`🔢 Page IDs range: ${simplePages[0]?.id} to ${simplePages[simplePages.length-1]?.id}`);
        
        // 2. Current complex implementation
        console.log('\n📊 METHOD 2: Complex block discovery (current implementation)');
        console.log('-'.repeat(40));
        
        // Import the production code
        const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
        const loader = new SharedManifestLoaders();
        
        const complexStart = Date.now();
        const complexResult = await loader.getEManuscriptaManifest(testUrl);
        const complexTime = Date.now() - complexStart;
        
        console.log(`⏱️  Time taken: ${complexTime}ms`);
        console.log(`📄 Pages found: ${complexResult.images.length}`);
        
        // Compare results
        console.log('\n' + '='.repeat(80));
        console.log('📈 COMPARISON RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n🏆 Speed improvement: ${Math.round(complexTime / simpleTime)}x faster`);
        console.log(`📊 Page count difference: ${Math.abs(simplePages.length - complexResult.images.length)} pages`);
        
        if (simplePages.length === 404) {
            console.log('✅ SUCCESS: Simple method found exactly 404 pages as expected!');
        } else {
            console.log(`⚠️  WARNING: Expected 404 pages, found ${simplePages.length}`);
        }
        
        // Verify we can access the pages
        console.log('\n🔍 Verifying page accessibility (testing first 3 pages)...');
        for (let i = 0; i < Math.min(3, simplePages.length); i++) {
            const page = simplePages[i];
            const response = await fetchUrl(page.url);
            console.log(`  Page ${page.number}: ${response.ok ? '✅ Accessible' : '❌ Not accessible'} (ID: ${page.id})`);
        }
        
        // Check if all page IDs form a proper sequence
        console.log('\n📊 Analyzing page ID sequence...');
        const gaps = [];
        for (let i = 1; i < simplePages.length; i++) {
            const gap = parseInt(simplePages[i].id) - parseInt(simplePages[i-1].id);
            if (gap !== 1 && gap !== 11) {
                gaps.push({ 
                    from: simplePages[i-1].id, 
                    to: simplePages[i].id, 
                    gap: gap,
                    pageFrom: simplePages[i-1].number,
                    pageTo: simplePages[i].number
                });
            }
        }
        
        if (gaps.length > 0) {
            console.log(`Found ${gaps.length} gaps in page sequence:`);
            gaps.slice(0, 5).forEach(g => {
                console.log(`  Pages ${g.pageFrom}-${g.pageTo}: IDs ${g.from} → ${g.to} (gap of ${g.gap})`);
            });
            if (gaps.length > 5) {
                console.log(`  ... and ${gaps.length - 5} more gaps`);
            }
        } else {
            console.log('✅ Page IDs form a continuous sequence');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run the comparison
(async () => {
    await compareWithCurrentImplementation();
})();