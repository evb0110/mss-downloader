import fetch from 'node-fetch';

async function testEndCondition() {
    console.log('=== Testing Vienna Manuscripta End Condition ===\n');
    
    const baseUrl = 'https://manuscripta.at/diglit/AT5000-588';
    
    // Test pages around the expected end (466 pages according to IIIF manifest)
    const testPages = [460, 465, 466, 467, 468, 470, 500];
    
    for (const pageNum of testPages) {
        const pageUrl = `${baseUrl}/${pageNum.toString().padStart(4, '0')}`;
        console.log(`\nTesting page ${pageNum}: ${pageUrl}`);
        
        try {
            const response = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            
            console.log(`  Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const html = await response.text();
                console.log(`  HTML size: ${html.length} characters`);
                
                // Extract img_max_url directly from the HTML
                const imgMaxMatch = html.match(/"img_max_url":"([^"]+)"/);
                if (imgMaxMatch) {
                    console.log(`  ✓ Found img_max_url: ${imgMaxMatch[1]}`);
                } else {
                    console.log(`  ✗ No img_max_url found - WOULD END HERE`);
                }
                
                // Check if pageInfo is empty (indicates end of manuscript)
                const pageInfoEmptyMatch = html.match(/const pageInfo = {};/);
                if (pageInfoEmptyMatch) {
                    console.log(`  ✗ Empty pageInfo found - WOULD END HERE`);
                } else {
                    console.log(`  ✓ PageInfo contains data`);
                }
                
                // Look for any indication this is the end
                if (html.includes('no more pages') || html.includes('end of document')) {
                    console.log(`  ✗ End of document indicator found`);
                }
            } else {
                console.log(`  ✗ HTTP error - WOULD END HERE`);
            }
            
        } catch (error) {
            console.log(`  ✗ Network error: ${error.message} - WOULD END HERE`);
        }
    }
    
    console.log('\n=== Summary ===');
    console.log('The algorithm should stop when:');
    console.log('1. HTTP response is not 200 OK');
    console.log('2. No img_max_url is found in HTML');
    console.log('3. pageInfo is empty (const pageInfo = {};)');
    console.log('4. Network error occurs');
    console.log('5. Safety limit of 1000 pages is reached');
}

testEndCondition().catch(console.error);