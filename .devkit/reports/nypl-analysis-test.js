// Test script to analyze NYPL URL issue
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

async function analyzeNyplUrl() {
    console.log('Fetching NYPL page...');
    const pageContent = await fetchPage(testUrl);
    
    // Extract carousel data
    const carouselMatch = pageContent.match(/data-items="([^"]+)"/);
    if (!carouselMatch) {
        console.log('❌ No carousel data found');
        return;
    }
    
    console.log('✅ Found carousel data');
    
    // Decode HTML entities and parse JSON
    const carouselDataHtml = carouselMatch[1];
    const carouselDataJson = carouselDataHtml
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    
    let carouselItems;
    try {
        carouselItems = JSON.parse(carouselDataJson);
        console.log(`✅ Parsed carousel JSON: ${carouselItems.length} items found`);
        
        // Show details of first few items
        console.log('\n=== First 3 carousel items ===');
        carouselItems.slice(0, 3).forEach((item, index) => {
            console.log(`Item ${index + 1}:`);
            console.log(`  - ID: ${item.id}`);
            console.log(`  - Image ID: ${item.image_id}`);
            console.log(`  - Title: ${item.title || 'No title'}`);
            if (item.sort_string) console.log(`  - Sort: ${item.sort_string}`);
        });
        
        // Check for pagination or total count indicators
        console.log('\n=== Checking for pagination indicators ===');
        
        // Look for any references to total pages, "more", "next", etc.
        const paginationKeywords = ['total', 'count', 'more', 'next', 'page', 'of', 'showing'];
        const foundPatterns = [];
        
        paginationKeywords.forEach(keyword => {
            const regex = new RegExp(`"[^"]*${keyword}[^"]*"[^:]*:[^,}]+`, 'gi');
            const matches = pageContent.match(regex);
            if (matches) {
                foundPatterns.push(...matches);
            }
        });
        
        if (foundPatterns.length > 0) {
            console.log('📄 Found potential pagination indicators:');
            foundPatterns.forEach(pattern => console.log(`  - ${pattern}`));
        } else {
            console.log('❌ No obvious pagination indicators found');
        }
        
        // Check if there are any API endpoints or additional data sources
        console.log('\n=== Checking for API endpoints ===');
        const apiPatterns = [
            /api\/[^"'\s]+/gi,
            /endpoint[^"'\s]*/gi,
            /ajax[^"'\s]*/gi,
            /json[^"'\s]*/gi
        ];
        
        apiPatterns.forEach((pattern, index) => {
            const matches = pageContent.match(pattern);
            if (matches) {
                console.log(`API pattern ${index + 1}: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
            }
        });
        
    } catch (error) {
        console.log(`❌ Failed to parse carousel JSON: ${error.message}`);
        console.log('Raw carousel data (first 200 chars):', carouselDataJson.substring(0, 200));
    }
}

analyzeNyplUrl().catch(console.error);