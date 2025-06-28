// NYPL Solution Test - Get all 304 pages via API
import https from 'https';

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function testNyplSolution() {
    console.log('🧪 TESTING NYPL SOLUTION - Getting All Pages via API');
    console.log('='.repeat(60));
    
    const parentUuid = '4c9aa5f0-f589-013a-4185-0242ac110003';
    const baseUrl = `https://digitalcollections.nypl.org/items/${parentUuid}/captures`;
    
    try {
        // Test with larger per_page to get all items
        const testUrl = `${baseUrl}?per_page=500`;
        console.log(`🚀 Testing: ${testUrl}`);
        
        const response = await fetchJson(testUrl);
        
        if (response.response && response.response.captures) {
            const items = response.response.captures;
            console.log(`\n✅ SUCCESS! Retrieved ${items.length} items`);
            console.log(`📊 Total available: ${response.response.total}`);
            
            // Extract image IDs
            const imageIds = items.map(item => item.image_id).filter(id => id);
            console.log(`📸 Image IDs found: ${imageIds.length}`);
            
            if (imageIds.length > 0) {
                console.log('\n🔗 First 5 high-res image URLs:');
                imageIds.slice(0, 5).forEach((imageId, i) => {
                    console.log(`  ${i + 1}. https://images.nypl.org/index.php?id=${imageId}&t=g`);
                });
                
                console.log('\n🔗 Last 5 high-res image URLs:');
                imageIds.slice(-5).forEach((imageId, i) => {
                    console.log(`  ${i + 1}. https://images.nypl.org/index.php?id=${imageId}&t=g`);
                });
            }
            
            // Check if we got all pages
            if (imageIds.length >= 300) {
                console.log('\n🎉 SOLUTION CONFIRMED: API returns full manuscript!');
                console.log(`   Current carousel: 15 pages`);
                console.log(`   API endpoint: ${imageIds.length} pages`);
                console.log(`   Improvement: ${imageIds.length - 15} additional pages recovered!`);
            }
            
        } else {
            console.log('❌ Unexpected response structure');
            console.log(JSON.stringify(response, null, 2).substring(0, 500));
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

testNyplSolution().catch(console.error);