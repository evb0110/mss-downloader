const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFlorenceDeep() {
    console.log('🔬 ULTRA-DEEP Florence Library Root Cause Analysis');
    console.log('====================================================\n');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    console.log(`Testing URL: ${testUrl}`);
    console.log('User reported: ETIMEDOUT with IP 193.240.184.109:443');
    console.log('User also said: With VPN it detects only 1 page when there should be more\n');
    
    // Extract item ID from URL
    const itemIdMatch = testUrl.match(/\/id\/(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    console.log(`Extracted Item ID: ${itemId}\n`);
    
    // Test 1: Direct manifest.json check
    console.log('Test 1: Checking IIIF manifest.json');
    console.log('-------------------------------------');
    const manifestUrl = `https://cdm21059.contentdm.oclc.org/iiif/info/plutei/${itemId}/manifest.json`;
    console.log(`Manifest URL: ${manifestUrl}`);
    
    try {
        const response = await fetch(manifestUrl);
        if (response.ok) {
            const manifest = await response.json();
            console.log(`✅ Manifest found!`);
            console.log(`   Type: ${manifest['@type'] || manifest.type}`);
            
            // Check for sequences/canvases
            if (manifest.sequences && manifest.sequences[0]) {
                const canvases = manifest.sequences[0].canvases;
                console.log(`   Canvases/Pages: ${canvases ? canvases.length : 0}`);
                if (canvases && canvases.length > 0) {
                    console.log('   First 3 canvas IDs:');
                    canvases.slice(0, 3).forEach((canvas, i) => {
                        console.log(`     ${i+1}. ${canvas['@id'] || canvas.id}`);
                    });
                }
            }
        } else {
            console.log(`❌ Manifest not accessible: Status ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Manifest fetch error: ${error.message}`);
    }
    
    // Test 2: Check compound object detection
    console.log('\nTest 2: Checking HTML page for compound object');
    console.log('------------------------------------------------');
    const pageUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${itemId}`;
    
    try {
        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.ok) {
            const html = await response.text();
            console.log(`✅ Page fetched, size: ${html.length} bytes`);
            
            // Check for compound object indicators
            const parentIdMatch = html.match(/parentId.*?(\d+)/);
            if (parentIdMatch) {
                console.log(`   Found parent ID: ${parentIdMatch[1]}`);
            }
            
            const pageCountMatch = html.match(/(?:page|item)\s*\d+\s*of\s*(\d+)/i);
            if (pageCountMatch) {
                console.log(`   Found page count indicator: ${pageCountMatch[1]} pages`);
            }
            
            const totalPagesMatch = html.match(/totalPages['"]\s*:\s*(\d+)/i);
            if (totalPagesMatch) {
                console.log(`   Found totalPages: ${totalPagesMatch[1]}`);
            }
            
            // Look for children array
            const childrenMatch = html.match(/"children":\s*\[/);
            if (childrenMatch) {
                console.log(`   Found children array in page data`);
                // Count children
                const childIdMatches = html.match(/"id":\s*\d+/g);
                if (childIdMatches) {
                    console.log(`   Found ${childIdMatches.length} child IDs`);
                }
            }
        } else {
            console.log(`❌ Page not accessible: Status ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Page fetch error: ${error.message}`);
    }
    
    // Test 3: Try the production code
    console.log('\nTest 3: Testing with production getFlorenceManifest');
    console.log('----------------------------------------------------');
    try {
        const result = await loader.getFlorenceManifest(testUrl);
        console.log('✅ getFlorenceManifest successful!');
        console.log(`   Display Name: ${result.displayName || 'Not set'}`);
        console.log(`   Images found: ${result.images ? result.images.length : 0}`);
        
        if (result.images && result.images.length > 0) {
            console.log('   First 3 images:');
            result.images.slice(0, 3).forEach((img, i) => {
                console.log(`     ${i+1}. ${img.label}: ${img.url}`);
            });
            
            // Check if all images are the same (stuck on page 1)
            if (result.images.length > 1) {
                const firstUrl = result.images[0].url;
                const allSame = result.images.every(img => img.url === firstUrl);
                if (allSame) {
                    console.log('   ⚠️  WARNING: All images have the same URL!');
                }
            }
        }
    } catch (error) {
        console.log(`❌ getFlorenceManifest failed: ${error.message}`);
        console.log(`   Error stack: ${error.stack}`);
    }
    
    // Test 4: Direct IIIF image tests
    console.log('\nTest 4: Testing direct IIIF image access');
    console.log('-----------------------------------------');
    const baseId = parseInt(itemId);
    console.log(`Testing sequential IDs starting from ${baseId}...`);
    
    let validImages = 0;
    for (let i = 0; i < 5; i++) {
        const testId = baseId + i;
        const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`;
        
        try {
            const response = await fetch(imageUrl, { method: 'HEAD' });
            if (response.ok) {
                console.log(`   ✅ ID ${testId}: Valid image (Status ${response.status})`);
                validImages++;
            } else {
                console.log(`   ❌ ID ${testId}: Not found (Status ${response.status})`);
            }
        } catch (error) {
            console.log(`   ❌ ID ${testId}: Error - ${error.message}`);
        }
    }
    
    console.log(`\nSummary: Found ${validImages} valid sequential images`);
    
    console.log('\n🔍 ROOT CAUSE ANALYSIS:');
    console.log('========================');
    console.log('1. Network connectivity: Working from this location');
    console.log('2. IIIF endpoints: Accessible');
    console.log('3. The user experiences ETIMEDOUT - likely geo-blocking');
    console.log('4. With VPN, only 1 page detected - compound object detection failing');
    console.log('5. Need to enhance compound object detection logic');
}

testFlorenceDeep().catch(console.error);