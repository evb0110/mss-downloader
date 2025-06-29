const https = require('https');

const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';

console.log('Testing e-manuscripta.ch page discovery fix...');
console.log(`Test URL: ${testUrl}`);

// Test the regex pattern
const urlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/zoom\/(\d+)/;
const urlMatch = testUrl.match(urlPattern);

if (urlMatch) {
    const [, library, manuscriptId] = urlMatch;
    console.log(`✅ URL parsing successful:`);
    console.log(`  Library: ${library}`);
    console.log(`  Manuscript ID: ${manuscriptId}`);
    
    // Fetch the page to test dropdown parsing
    console.log('\\nFetching page to test dropdown parsing...');
    
    https.get(testUrl, (response) => {
        console.log(`Status: ${response.statusCode}`);
        
        let data = '';
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', () => {
            console.log(`Page size: ${data.length} bytes`);
            
            // Test the new dropdown regex
            const pageDropdownRegex = /<option\\s+value="(\\d+)"\\s*>\\s*\\[(\\d+)\\]/g;
            const pageMatches = Array.from(data.matchAll(pageDropdownRegex));
            
            console.log(`\\n📋 Dropdown parsing results:`);
            console.log(`Found ${pageMatches.length} option elements`);
            
            if (pageMatches.length > 0) {
                console.log('✅ SUCCESS: Page dropdown found and parsed');
                console.log(`First 5 pages:`);
                pageMatches.slice(0, 5).forEach((match, i) => {
                    console.log(`  [${match[2]}] → ID ${match[1]}`);
                });
                
                if (pageMatches.length > 5) {
                    console.log(`Last 3 pages:`);
                    pageMatches.slice(-3).forEach((match, i) => {
                        console.log(`  [${match[2]}] → ID ${match[1]}`);
                    });
                }
                
                const totalPages = pageMatches.length;
                console.log(`\\n📊 Total pages: ${totalPages} (vs previous implementation: 1)`);
                console.log(`Improvement: ${totalPages}x more content detected`);
                
                // Test image URL generation
                const firstPageId = pageMatches[0][1];
                const lastPageId = pageMatches[pageMatches.length - 1][1];
                console.log(`\\n🔗 Sample image URLs:`);
                console.log(`  Page 1: https://www.e-manuscripta.ch/${library}/download/webcache/0/${firstPageId}`);
                console.log(`  Last page: https://www.e-manuscripta.ch/${library}/download/webcache/0/${lastPageId}`);
                
            } else {
                console.log('❌ FAILED: No page dropdown found');
                
                // Test fallback regex
                const pageNavRegex = /\\[(\\d+)\\]/g;
                const navMatches = Array.from(data.matchAll(pageNavRegex));
                console.log(`Fallback navigation links found: ${navMatches.length}`);
            }
        });
    }).on('error', (err) => {
        console.log(`❌ Request failed: ${err.message}`);
    });
    
} else {
    console.log('❌ URL parsing failed');
}