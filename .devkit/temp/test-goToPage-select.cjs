const https = require('https');

const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';

console.log('Testing goToPage select element extraction...');

https.get(testUrl, (response) => {
    let data = '';
    response.on('data', (chunk) => {
        data += chunk;
    });
    
    response.on('end', () => {
        // Find the complete goToPage select element
        const selectStart = data.indexOf('<select id="goToPage"');
        const selectEnd = data.indexOf('</select>', selectStart);
        
        if (selectStart !== -1 && selectEnd !== -1) {
            const selectElement = data.substring(selectStart, selectEnd + 9);
            console.log(`Found goToPage select element (${selectElement.length} chars)`);
            
            // Extract all options from this select element
            const optionRegex = /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*/g;
            const optionMatches = Array.from(selectElement.matchAll(optionRegex));
            
            console.log(`Found ${optionMatches.length} options in goToPage select`);
            
            if (optionMatches.length > 0) {
                console.log('First 5 options:');
                optionMatches.slice(0, 5).forEach((match, i) => {
                    console.log(`  Page [${match[2]}] → ID ${match[1]}`);
                });
                
                console.log('Last 5 options:');
                optionMatches.slice(-5).forEach((match, i) => {
                    console.log(`  Page [${match[2]}] → ID ${match[1]}`);
                });
                
                // Check page sequence
                const pageNumbers = optionMatches.map(m => parseInt(m[2], 10)).sort((a, b) => a - b);
                console.log(`\\nPage range: ${pageNumbers[0]} to ${pageNumbers[pageNumbers.length - 1]}`);
                console.log(`Total pages: ${optionMatches.length}`);
                
                // Test a few image URLs
                console.log('\\nSample image URLs:');
                [0, Math.floor(optionMatches.length / 2), optionMatches.length - 1].forEach(i => {
                    if (optionMatches[i]) {
                        const imageUrl = `https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/${optionMatches[i][1]}`;
                        console.log(`  Page [${optionMatches[i][2]}]: ${imageUrl}`);
                    }
                });
                
            } else {
                console.log('❌ No options found in goToPage select element');
                console.log('Sample content:', selectElement.substring(0, 500));
            }
            
        } else {
            console.log('❌ goToPage select element not found');
            
            // Try to find any select with "goToPage" in it
            const goToPageMatch = data.match(/<select[^>]*goToPage[^>]*>.*?<\/select>/gi);
            if (goToPageMatch) {
                console.log('Found alternative goToPage select:', goToPageMatch[0].substring(0, 200));
            }
        }
    });
}).on('error', (err) => {
    console.log(`Error: ${err.message}`);
});