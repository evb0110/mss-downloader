const https = require('https');

const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';

console.log('Inspecting e-manuscripta.ch HTML structure...');

https.get(testUrl, (response) => {
    let data = '';
    response.on('data', (chunk) => {
        data += chunk;
    });
    
    response.on('end', () => {
        console.log('\\n=== SELECT ELEMENTS ===');
        const selectMatches = data.match(/<select[^>]*>.*?<\/select>/gi);
        if (selectMatches) {
            selectMatches.forEach((select, i) => {
                console.log(`Select ${i + 1}: ${select.substring(0, 200)}...`);
            });
        } else {
            console.log('No select elements found');
        }
        
        console.log('\\n=== OPTION ELEMENTS ===');
        const optionMatches = data.match(/<option[^>]*>.*?<\/option>/gi);
        if (optionMatches) {
            console.log(`Found ${optionMatches.length} option elements:`);
            optionMatches.slice(0, 10).forEach((option, i) => {
                console.log(`Option ${i + 1}: ${option}`);
            });
            if (optionMatches.length > 10) {
                console.log(`... and ${optionMatches.length - 10} more`);
            }
        } else {
            console.log('No option elements found');
        }
        
        console.log('\\n=== PAGE NAVIGATION PATTERNS ===');
        // Look for various navigation patterns
        const patterns = [
            /\[(\d+)\]/g,
            /page\s*(\d+)/gi,
            /seite\s*(\d+)/gi,
            /goto[^>]*page/gi,
            /navigation/gi
        ];
        
        patterns.forEach((pattern, i) => {
            const matches = Array.from(data.matchAll(pattern));
            console.log(`Pattern ${i + 1} (${pattern.source}): ${matches.length} matches`);
            if (matches.length > 0 && matches.length <= 10) {
                matches.forEach(match => console.log(`  ${match[0]}`));
            } else if (matches.length > 10) {
                console.log(`  First 5: ${matches.slice(0, 5).map(m => m[0]).join(', ')}`);
                console.log(`  Last 5: ${matches.slice(-5).map(m => m[0]).join(', ')}`);
            }
        });
        
        console.log('\\n=== ZOOM-RELATED LINKS ===');
        const zoomPattern = /\/zoom\/(\d+)/g;
        const zoomMatches = Array.from(data.matchAll(zoomPattern));
        console.log(`Found ${zoomMatches.length} zoom links:`);
        const uniqueZoomIds = [...new Set(zoomMatches.map(m => m[1]))];
        console.log(`Unique zoom IDs: ${uniqueZoomIds.join(', ')}`);
        
        console.log('\\n=== JAVASCRIPT VARIABLES ===');
        // Look for JavaScript variables that might contain page info
        const jsPatterns = [
            /const\s+(\w+)\s*=\s*\d+/g,
            /var\s+(\w+)\s*=\s*\d+/g,
            /let\s+(\w+)\s*=\s*\d+/g,
            /"totalPages"\s*:\s*(\d+)/g,
            /"pageCount"\s*:\s*(\d+)/g
        ];
        
        jsPatterns.forEach((pattern, i) => {
            const matches = Array.from(data.matchAll(pattern));
            if (matches.length > 0) {
                console.log(`JS Pattern ${i + 1}: ${matches.length} matches`);
                matches.slice(0, 5).forEach(match => console.log(`  ${match[0]}`));
            }
        });
        
    });
}).on('error', (err) => {
    console.log(`Error: ${err.message}`);
});