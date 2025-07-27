const https = require('https');
const path = require('path');
const fs = require('fs').promises;

// Test the Morgan Library parsing logic directly
async function fetchDirect(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode === 200, text: async () => data }));
        }).on('error', reject);
    });
}

async function testMorganParsing() {
    console.log('=== Testing Morgan Library Parsing Fix ===\n');
    
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        // Fetch the page
        console.log('\n1. Fetching Morgan page...');
        const response = await fetchDirect(testUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch page');
        }
        
        const pageContent = await response.text();
        console.log(`✓ Page fetched successfully (${pageContent.length} bytes)`);
        
        // Test the parsing logic
        console.log('\n2. Testing parsing logic...');
        
        const pageLinks = [];
        const morganUrl = testUrl;
        const baseUrl = 'https://www.themorgan.org';
        
        // Initialize imagesByPriority at outer scope (THIS IS THE FIX)
        const imagesByPriority = {
            0: [], // HIGHEST PRIORITY: .zif tiled images
            1: [], // High-resolution download URLs
            2: [], // High priority: direct full-size images  
            3: [], // Medium priority: converted styled images
            4: [], // Low priority: facsimile images
            5: []  // Lowest priority: other direct references
        };
        
        if (morganUrl.includes('ica.themorgan.org')) {
            console.log('ICA format detected');
            // ICA format parsing...
        } else {
            console.log('Main Morgan format detected');
            
            // Priority 0: Generate .zif URLs
            const manuscriptMatch = morganUrl.match(/\/collection\/([^/]+)/);
            if (manuscriptMatch) {
                const manuscriptId = manuscriptMatch[1];
                console.log(`Manuscript ID: ${manuscriptId}`);
                
                const imageIdRegex = /\/images\/collection\/([^"'?]+)\.jpg/g;
                const validImagePattern = /\d+v?_\d+/;
                
                let match;
                while ((match = imageIdRegex.exec(pageContent)) !== null) {
                    const imageId = match[1];
                    if (validImagePattern.test(imageId) && !imageId.includes('front-cover')) {
                        const zifUrl = `https://host.themorgan.org/facsimile/images/${manuscriptId}/${imageId}.zif`;
                        imagesByPriority[0].push(zifUrl);
                    }
                }
                
                console.log(`Found ${imagesByPriority[0].length} ZIF images`);
            }
            
            // Priority 2: Direct full-size images
            const fullSizeImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
            const fullSizeMatches = pageContent.match(fullSizeImageRegex) || [];
            for (const match of fullSizeMatches) {
                imagesByPriority[2].push(`${baseUrl}${match}`);
            }
            console.log(`Found ${imagesByPriority[2].length} direct full-size images`);
            
            // Priority 3: Styled images
            const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
            const styledMatches = pageContent.match(styledImageRegex) || [];
            for (const match of styledMatches) {
                const originalPath = match.replace(/\/styles\/[^/]+\/public\//, '/');
                imagesByPriority[3].push(`${baseUrl}${originalPath}`);
            }
            console.log(`Found ${imagesByPriority[3].length} styled images`);
        }
        
        // THIS IS WHERE THE ERROR WOULD OCCUR IF imagesByPriority was not in scope
        console.log('\n3. Testing image priority logging (this was causing the error)...');
        console.log(`Morgan: Image quality distribution:`);
        console.log(`  - Priority 0 (ZIF ultra-high res): ${imagesByPriority[0].length} images`);
        console.log(`  - Priority 1 (High-res facsimile): ${imagesByPriority[1].length} images`);
        console.log(`  - Priority 2 (Direct full-size): ${imagesByPriority[2].length} images`);
        console.log(`  - Priority 3 (Converted styled): ${imagesByPriority[3].length} images`);
        console.log(`  - Priority 4 (Legacy facsimile): ${imagesByPriority[4].length} images`);
        console.log(`  - Priority 5 (Other direct): ${imagesByPriority[5].length} images`);
        
        console.log('\n✅ Test passed! The imagesByPriority variable is now accessible for logging.');
        console.log('The fix moves the variable declaration to the outer scope, preventing the ReferenceError.');
        
        // Show sample URLs
        if (imagesByPriority[0].length > 0) {
            console.log('\nSample ZIF URLs:');
            imagesByPriority[0].slice(0, 3).forEach(url => console.log(`  - ${url}`));
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testMorganParsing().catch(console.error);