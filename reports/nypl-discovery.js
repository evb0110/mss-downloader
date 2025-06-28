// NYPL Discovery Analysis - CRITICAL FINDING
import https from 'https';

const testUrl = 'https://digitalcollections.nypl.org/items/6a709e10-1cda-013b-b83f-0242ac110002';

async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function analyzeDataTotal() {
    console.log('🔍 NYPL CRITICAL ANALYSIS - FINDING THE MISSING PAGES');
    console.log('='.repeat(60));
    
    const pageContent = await fetchPage(testUrl);
    
    // Look for data-total attributes which show the real total count
    const dataTotalMatches = pageContent.match(/data-total="(\d+)"/g);
    if (dataTotalMatches) {
        console.log('📊 FOUND data-total ATTRIBUTES:');
        dataTotalMatches.forEach(match => {
            const total = match.match(/data-total="(\d+)"/)[1];
            console.log(`   - data-total="${total}"`);
        });
    }
    
    // Look for data-fetch-url patterns which might reveal API endpoints
    const fetchUrls = pageContent.match(/data-fetch-url="([^"]+)"/g);
    if (fetchUrls) {
        console.log('\n🔗 FOUND data-fetch-url ATTRIBUTES:');
        fetchUrls.forEach(url => {
            console.log(`   - ${url}`);
        });
    }
    
    // Extract the carousel data to see what we currently get
    const carouselMatch = pageContent.match(/data-items="([^"]+)"/);
    if (carouselMatch) {
        const carouselDataHtml = carouselMatch[1];
        const carouselDataJson = carouselDataHtml
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
        
        const carouselItems = JSON.parse(carouselDataJson);
        console.log(`\n📝 CURRENT CAROUSEL DATA: ${carouselItems.length} items`);
        
        // Look for UUID patterns that might help us find the parent collection
        const uuid = testUrl.match(/items\/([a-f0-9-]+)/)[1];
        console.log(`\n🆔 CURRENT ITEM UUID: ${uuid}`);
        
        // Check if there are references to parent IDs or collection IDs
        const parentMatches = pageContent.match(/4c9aa5f0-f589-013a-4185-0242ac110003/g);
        if (parentMatches) {
            console.log(`\n🎯 FOUND PARENT/COLLECTION UUID: 4c9aa5f0-f589-013a-4185-0242ac110003`);
            console.log(`   (Found ${parentMatches.length} references)`);
        }
        
        // Check for the specific data-fetch-url for this item's captures
        const capturesUrl = pageContent.match(/data-fetch-url="([^"]+captures[^"]+)"/);
        if (capturesUrl) {
            console.log(`\n🎯 CAPTURES API ENDPOINT: ${capturesUrl[1]}`);
            
            // Test this endpoint
            const fullCapturesUrl = `https://digitalcollections.nypl.org${capturesUrl[1]}`;
            console.log(`\n🚀 TESTING CAPTURES API: ${fullCapturesUrl}`);
            
            try {
                const capturesData = await fetchPage(fullCapturesUrl);
                console.log(`\n📄 CAPTURES API RESPONSE (first 500 chars):`);
                console.log(capturesData.substring(0, 500));
                
                // Try to parse as JSON
                try {
                    const capturesJson = JSON.parse(capturesData);
                    if (capturesJson.items && Array.isArray(capturesJson.items)) {
                        console.log(`\n✅ SUCCESS! CAPTURES API RETURNS ${capturesJson.items.length} ITEMS`);
                        console.log('First 3 items:');
                        capturesJson.items.slice(0, 3).forEach((item, i) => {
                            console.log(`  ${i + 1}. ID: ${item.id}, Image ID: ${item.image_id}`);
                        });
                        
                        if (capturesJson.items.length > 15) {
                            console.log(`\n🎉 SOLUTION FOUND: API returns ${capturesJson.items.length} items vs carousel's 15!`);
                        }
                    }
                } catch (e) {
                    console.log('\n❌ Captures response is not JSON');
                }
            } catch (error) {
                console.log(`\n❌ Failed to fetch captures API: ${error.message}`);
            }
        }
    }
}

analyzeDataTotal().catch(console.error);