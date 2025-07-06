const https = require('https');
const { execSync } = require('child_process');

// Simulate the exact behavior from the EnhancedManuscriptDownloaderService
async function reproduceMDCCataloniaError() {
    console.log('=== Reproducing MDC Catalonia Fetch Error ===');
    
    const originalUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';
    
    try {
        console.log('1. Extracting URL components...');
        const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
        if (!urlMatch) {
            throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
        }
        
        const collection = urlMatch[1];
        const itemId = urlMatch[2];
        console.log(`   Collection: ${collection}, Item ID: ${itemId}`);
        
        console.log('\n2. Testing compound object API...');
        const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
        console.log(`   URL: ${compoundUrl}`);
        
        // Try with fetch-like behavior (Node.js https)
        const compoundResponse = await testWithNodeFetch(compoundUrl);
        console.log(`   Status: ${compoundResponse.status}`);
        
        if (!compoundResponse.ok) {
            throw new Error(`Failed to fetch compound object info: ${compoundResponse.status}`);
        }
        
        const compoundData = await compoundResponse.json();
        console.log(`   Success: Found ${compoundData.page ? compoundData.page.length : 'N/A'} pages`);
        
        console.log('\n3. Testing IIIF endpoints...');
        
        // Test the problematic IIIF endpoint that was failing
        const iiifInfoUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
        console.log(`   IIIF Info URL: ${iiifInfoUrl}`);
        
        const iiifResponse = await testWithNodeFetch(iiifInfoUrl);
        console.log(`   IIIF Status: ${iiifResponse.status}`);
        
        if (!iiifResponse.ok) {
            console.log('   ❌ IIIF endpoint failed - this is the likely cause!');
            const errorText = await iiifResponse.text();
            console.log(`   Error response: ${errorText}`);
            
            // This is the error that causes the service to fail
            console.log('\n   🔍 ROOT CAUSE IDENTIFIED:');
            console.log('   The implementation tries to get IIIF info for the parent item (175331)');
            console.log('   but this parent item is not a single image - it\'s a compound object');
            console.log('   Only individual pages (like 174519, 174520, etc.) have IIIF endpoints');
            
            // Test with a valid page ID from the compound object
            if (compoundData.page && compoundData.page.length > 0) {
                const firstPageId = compoundData.page[0].pageptr;
                console.log(`\n   Testing with valid page ID: ${firstPageId}`);
                
                const validIiifUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${firstPageId}/info.json`;
                const validIiifResponse = await testWithNodeFetch(validIiifUrl);
                console.log(`   Valid IIIF Status: ${validIiifResponse.status}`);
                
                if (validIiifResponse.ok) {
                    console.log('   ✅ Valid page IIIF endpoint works!');
                } else {
                    console.log('   ❌ Even valid page IIIF endpoint fails');
                }
            }
        } else {
            console.log('   ✅ IIIF endpoint works (unexpected!)');
        }
        
        console.log('\n4. Code Flow Analysis...');
        console.log('   Current implementation logic:');
        console.log('   - Gets compound object info ✅');
        console.log('   - Checks if pageArray exists ✅');
        console.log('   - If no pageArray, tries to get IIIF info for parent item ❌');
        console.log('   - Parent item (175331) is not a single image, so IIIF fails ❌');
        console.log('   - Should skip the single-page logic for compound objects ✅');
        
        // Test the specific scenario where the bug occurs
        console.log('\n5. Testing Bug Scenario...');
        
        // Check what happens when we have a compound object
        let pageArray = compoundData.page;
        if (!pageArray && compoundData.node && compoundData.node.page) {
            pageArray = compoundData.node.page;
        }
        
        if (!pageArray || !Array.isArray(pageArray)) {
            console.log('   📍 BUG TRIGGER: No pageArray found, entering single-page logic');
            console.log('   This should NOT happen for compound objects with 812 pages!');
            
            // This is where the bug manifests
            const buggyIiifUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`;
            console.log(`   Buggy IIIF URL: ${buggyIiifUrl}`);
            
            try {
                const buggyResponse = await testWithNodeFetch(buggyIiifUrl);
                console.log(`   Buggy Response Status: ${buggyResponse.status}`);
                
                if (!buggyResponse.ok) {
                    console.log('   ❌ This is where the service fails!');
                    console.log('   The service throws: "Failed to fetch IIIF info for single page"');
                }
            } catch (error) {
                console.log(`   ❌ Fetch error: ${error.message}`);
            }
        } else {
            console.log('   ✅ pageArray found, should proceed with compound object logic');
            console.log(`   Pages: ${pageArray.length}`);
        }
        
    } catch (error) {
        console.error('❌ Error during reproduction:', error.message);
    }
}

function testWithNodeFetch(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000
        };
        
        const req = https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

reproduceMDCCataloniaError().catch(console.error);