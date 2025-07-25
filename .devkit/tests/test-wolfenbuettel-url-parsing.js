// Simple test to verify URL parsing logic for Wolfenbüttel

function parseWolfenbuettelUrl(wolfenbuettelUrl) {
    // URL formats:
    // 1. https://diglib.hab.de/wdb.php?dir=mss/1008-helmst
    // 2. https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=
    
    let manuscriptId;
    
    // Try original format first
    const dirMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
    if (dirMatch) {
        manuscriptId = dirMatch[1];
    } else {
        // Try alternative format - extract from path
        const pathMatch = wolfenbuettelUrl.match(/diglib\.hab\.de\/([^\/]+\/[^\/]+\/[^\/]+)/);
        if (!pathMatch) {
            throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
        }
        manuscriptId = pathMatch[1]; // e.g., "varia/selecta/ed000011"
    }
    
    return manuscriptId;
}

function constructUrls(manuscriptId, imageName = '00001') {
    let thumbsUrl;
    let imageUrl;
    
    // Construct thumbs URL based on manuscript ID format
    if (manuscriptId.startsWith('mss/')) {
        // Already has mss/ prefix
        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=0`;
        imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
    } else if (manuscriptId.includes('/')) {
        // Alternative format like varia/selecta/ed000011
        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=0`;
        imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
    } else {
        // Just the manuscript number
        thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=0`;
        imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
    }
    
    return { thumbsUrl, imageUrl };
}

// Test cases
const testUrls = [
    {
        name: 'Original format',
        url: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',
        expectedId: '1008-helmst'
    },
    {
        name: 'Alternative format',
        url: 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=',
        expectedId: 'varia/selecta/ed000011'
    }
];

console.log('Testing Wolfenbüttel URL parsing...\n');

for (const test of testUrls) {
    console.log(`=== ${test.name} ===`);
    console.log(`Input URL: ${test.url}`);
    
    try {
        const manuscriptId = parseWolfenbuettelUrl(test.url);
        console.log(`✓ Parsed manuscript ID: ${manuscriptId}`);
        console.log(`  Expected: ${test.expectedId}`);
        console.log(`  Match: ${manuscriptId === test.expectedId ? '✓' : '✗'}`);
        
        const urls = constructUrls(manuscriptId);
        console.log(`\n  Generated URLs:`);
        console.log(`  Thumbs URL: ${urls.thumbsUrl}`);
        console.log(`  Image URL: ${urls.imageUrl}`);
        
    } catch (error) {
        console.error(`✗ Error: ${error.message}`);
    }
    
    console.log('\n');
}

// Test actual URL fetching
const https = require('https');
const http = require('http');

async function testUrlAccess(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        client.get(url, (res) => {
            resolve({ 
                status: res.statusCode, 
                ok: res.statusCode >= 200 && res.statusCode < 300 
            });
        }).on('error', (err) => {
            resolve({ status: 0, ok: false, error: err.message });
        });
    });
}

async function testActualUrls() {
    console.log('Testing actual URL accessibility...\n');
    
    for (const test of testUrls) {
        const manuscriptId = parseWolfenbuettelUrl(test.url);
        const urls = constructUrls(manuscriptId);
        
        console.log(`=== ${test.name} ===`);
        
        // Test thumbs URL
        const thumbsResult = await testUrlAccess(urls.thumbsUrl);
        console.log(`Thumbs URL: ${thumbsResult.ok ? '✓' : '✗'} (Status: ${thumbsResult.status})`);
        
        // Test image URL
        const imageResult = await testUrlAccess(urls.imageUrl);
        console.log(`Image URL: ${imageResult.ok ? '✓' : '✗'} (Status: ${imageResult.status})`);
        
        console.log('\n');
    }
}

testActualUrls().catch(console.error);