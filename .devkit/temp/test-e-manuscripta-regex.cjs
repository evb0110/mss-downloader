const https = require('https');

const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';

console.log('Testing updated e-manuscripta.ch regex...');

https.get(testUrl, (response) => {
    let data = '';
    response.on('data', (chunk) => {
        data += chunk;
    });
    
    response.on('end', () => {
        // Test the updated regex
        const pageDropdownRegex = /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*<\/option>/g;
        const pageMatches = Array.from(data.matchAll(pageDropdownRegex));
        
        console.log(`Updated regex found: ${pageMatches.length} matches`);
        
        if (pageMatches.length > 0) {
            console.log('✅ SUCCESS: Updated regex works!');
            console.log('First 5 matches:');
            pageMatches.slice(0, 5).forEach((match, i) => {
                console.log(`  Page [${match[2]}] → ID ${match[1]}`);
            });
            
            console.log('Last 5 matches:');
            pageMatches.slice(-5).forEach((match, i) => {
                console.log(`  Page [${match[2]}] → ID ${match[1]}`);
            });
            
            console.log(`\\nTotal pages detected: ${pageMatches.length}`);
            
            // Verify no gaps in page numbers
            const pageNumbers = pageMatches.map(m => parseInt(m[2], 10)).sort((a, b) => a - b);
            const expectedPages = pageNumbers[pageNumbers.length - 1];
            console.log(`Expected: ${expectedPages} pages, Got: ${pageNumbers.length} pages`);
            
            if (pageNumbers.length === expectedPages) {
                console.log('✅ Complete sequence - no missing pages');
            } else {
                console.log('⚠️  Some pages may be missing');
            }
            
        } else {
            console.log('❌ Updated regex still failed');
            
            // Test simpler patterns
            console.log('\\nTesting simpler patterns...');
            
            const patterns = [
                /<option value="(\d+)">\[(\d+)\]/g,
                /<option[^>]+value="(\d+)"[^>]*>\[(\d+)\]/g,
                /value="(\d+)"[^>]*>\[(\d+)\]/g
            ];
            
            patterns.forEach((pattern, i) => {
                const matches = Array.from(data.matchAll(pattern));
                console.log(`Pattern ${i + 1}: ${matches.length} matches`);
                if (matches.length > 0) {
                    console.log(`  Sample: Page [${matches[0][2]}] → ID ${matches[0][1]}`);
                }
            });
        }
    });
}).on('error', (err) => {
    console.log(`Error: ${err.message}`);
});