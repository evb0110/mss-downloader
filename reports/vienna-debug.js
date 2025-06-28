import fetch from 'node-fetch';

async function debugViennaManuscripta() {
    console.log('=== Vienna Manuscripta Debug Test ===\n');
    
    const manuscriptaUrl = 'https://manuscripta.at/diglit/AT5000-588/0001';
    
    // Extract manuscript ID from URL
    const urlMatch = manuscriptaUrl.match(/\/diglit\/(AT\d+-\d+)/);
    if (!urlMatch) {
        throw new Error('Invalid Vienna Manuscripta URL format');
    }
    
    const manuscriptId = urlMatch[1];
    console.log('Manuscript ID:', manuscriptId);
    
    // Extract base URL
    const baseUrl = `https://manuscripta.at/diglit/${manuscriptId}`;
    
    const pageLinks = [];
    let pageNum = 1;
    
    console.log('\n=== Page Discovery Loop ===');
    
    // Iterate through pages to find all images (reproducing the exact logic)
    while (true) {
        const pageUrl = `${baseUrl}/${pageNum.toString().padStart(4, '0')}`;
        console.log(`\nChecking page ${pageNum}: ${pageUrl}`);
        
        try {
            const startTime = Date.now();
            
            const response = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 30000 // 30 second timeout
            });
            
            const responseTime = Date.now() - startTime;
            console.log(`  Response time: ${responseTime}ms`);
            
            if (!response.ok) {
                console.log(`  HTTP ${response.status}: ${response.statusText} - assuming end of manuscript`);
                break;
            }
            
            const html = await response.text();
            console.log(`  HTML size: ${html.length} characters`);
            
            // Extract img_max_url directly from the HTML (simpler and more reliable)
            const imgMaxMatch = html.match(/"img_max_url":"([^"]+)"/);
            if (!imgMaxMatch) {
                console.log(`  No img_max_url found - assuming end of manuscript`);
                break;
            }
            
            // Check if pageInfo is empty (indicates end of manuscript)
            const pageInfoEmptyMatch = html.match(/const pageInfo = {};/);
            if (pageInfoEmptyMatch) {
                console.log(`  Empty pageInfo found - end of manuscript reached`);
                break;
            }
            
            const imageUrl = imgMaxMatch[1];
            pageLinks.push(imageUrl);
            console.log(`  ✓ Found image: ${imageUrl}`);
            
            pageNum++;
            
            // Safety check to prevent infinite loops
            if (pageNum > 50) {  // Lower limit for debugging
                console.warn('  ⚠️  Reached debug limit (50), stopping early');
                break;
            }
            
            // Add small delay to be respectful
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);
            break;
        }
    }
    
    console.log(`\n=== Results ===`);
    console.log(`Total pages found: ${pageLinks.length}`);
    console.log(`Expected pages: 466 (from IIIF manifest)`);
    
    if (pageLinks.length === 0) {
        console.log('❌ No pages found - this would cause our implementation to fail');
    } else if (pageLinks.length < 100) {
        console.log('⚠️  Fewer pages than expected - might be hitting end condition too early');
    } else {
        console.log('✅ Found reasonable number of pages');
    }
    
    console.log('\nFirst 5 image URLs:');
    pageLinks.slice(0, 5).forEach((url, index) => {
        console.log(`  ${index + 1}: ${url}`);
    });
    
    if (pageLinks.length > 5) {
        console.log('\nLast 3 image URLs:');
        pageLinks.slice(-3).forEach((url, index) => {
            console.log(`  ${pageLinks.length - 2 + index}: ${url}`);
        });
    }
}

// Run the debug test
debugViennaManuscripta().catch(console.error);