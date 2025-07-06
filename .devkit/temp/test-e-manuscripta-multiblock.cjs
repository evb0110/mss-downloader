const fetch = require('node-fetch').default;

async function testEManuscriptaMultiBlock() {
    console.log('=== Testing E-Manuscripta Multi-Block Manuscript ===');
    
    const mainUrl = 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222';
    
    try {
        console.log(`\n1. Fetching main titleinfo page: ${mainUrl}`);
        const response = await fetch(mainUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`Page content loaded: ${html.length} characters`);
        
        // Extract the title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            console.log(`Title: ${titleMatch[1].trim()}`);
        }
        
        // Look for thumbview URLs using multiple patterns
        console.log('\n2. Searching for thumbview blocks...');
        
        // Pattern 1: Direct href links to thumbview
        const thumbviewPattern = /href="([^"]*\/content\/thumbview\/\d+)"/g;
        const thumbviewUrls = [];
        let match;
        while ((match = thumbviewPattern.exec(html)) !== null) {
            let url = match[1];
            if (url.startsWith('/')) {
                url = `https://www.e-manuscripta.ch${url}`;
            } else if (!url.startsWith('http')) {
                url = `https://www.e-manuscripta.ch/${url}`;
            }
            thumbviewUrls.push(url);
        }
        
        console.log(`Found ${thumbviewUrls.length} thumbview URLs via direct links:`);
        thumbviewUrls.forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`);
        });
        
        // Pattern 2: Look for thumbview IDs in data attributes or JavaScript
        console.log('\n3. Searching for thumbview IDs in JavaScript/data...');
        const thumbviewIdPattern = /(?:thumbview|blockId)['":\s]*(\d+)/g;
        const foundIds = [];
        while ((match = thumbviewIdPattern.exec(html)) !== null) {
            foundIds.push(match[1]);
        }
        
        console.log(`Found ${foundIds.length} thumbview IDs:`, foundIds);
        
        // Pattern 3: Look for page range indicators
        console.log('\n4. Searching for page range indicators...');
        const pageRangePattern = /\[(\d+)-(\d+)\]/g;
        const pageRanges = [];
        while ((match = pageRangePattern.exec(html)) !== null) {
            pageRanges.push(`[${match[1]}-${match[2]}]`);
        }
        
        console.log(`Found ${pageRanges.length} page ranges:`, pageRanges);
        
        // Pattern 4: Look for any numeric IDs that might be blocks
        console.log('\n5. Searching for potential block IDs...');
        const blockIdPattern = /(?:href|data-[^=]*|id)="[^"]*?(\d{7,})/g;
        const potentialBlockIds = [];
        while ((match = blockIdPattern.exec(html)) !== null) {
            potentialBlockIds.push(match[1]);
        }
        
        console.log(`Found ${potentialBlockIds.length} potential block IDs:`, [...new Set(potentialBlockIds)]);
        
        // Test if we can find the known working URLs
        console.log('\n6. Testing known working URLs...');
        const knownUrls = [
            'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
            'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
            'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'
        ];
        
        for (const url of knownUrls) {
            try {
                const testResponse = await fetch(url);
                console.log(`  ${url}: ${testResponse.status} ${testResponse.statusText}`);
            } catch (error) {
                console.log(`  ${url}: ERROR - ${error.message}`);
            }
        }
        
        // Check if these IDs appear in the HTML
        console.log('\n7. Checking if known block IDs appear in HTML...');
        const knownIds = ['5157616', '5157228', '5157615'];
        for (const id of knownIds) {
            const found = html.includes(id);
            console.log(`  Block ID ${id}: ${found ? 'FOUND' : 'NOT FOUND'}`);
            if (found) {
                // Find the context around this ID
                const index = html.indexOf(id);
                const context = html.substring(index - 50, index + 50);
                console.log(`    Context: ...${context}...`);
            }
        }
        
        console.log('\n=== Analysis Complete ===');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEManuscriptaMultiBlock().catch(console.error);