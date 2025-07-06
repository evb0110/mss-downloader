const fetch = require('node-fetch').default;
const fs = require('fs');

async function deepAnalyzeEManuscripta() {
    console.log('=== Deep E-Manuscripta Analysis ===');
    
    const mainUrl = 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222';
    
    try {
        console.log(`\n1. Fetching main titleinfo page: ${mainUrl}`);
        const response = await fetch(mainUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`Page content loaded: ${html.length} characters`);
        
        // Save the HTML for manual inspection
        fs.writeFileSync('.devkit/temp/titleinfo-5157222.html', html);
        console.log('HTML saved to .devkit/temp/titleinfo-5157222.html');
        
        // Let's look for any pattern that might indicate multiple blocks
        console.log('\n2. Searching for potential block patterns...');
        
        // Look for the table of contents or navigation structure
        console.log('\n2a. Searching for navigation/TOC structure...');
        const tocPatterns = [
            /class="[^"]*toc[^"]*"/gi,
            /class="[^"]*nav[^"]*"/gi,
            /class="[^"]*menu[^"]*"/gi,
            /class="[^"]*index[^"]*"/gi,
            /class="[^"]*list[^"]*"/gi,
            /id="[^"]*toc[^"]*"/gi,
            /id="[^"]*nav[^"]*"/gi,
            /id="[^"]*menu[^"]*"/gi,
            /id="[^"]*index[^"]*"/gi,
            /id="[^"]*list[^"]*"/gi
        ];
        
        let foundTocElements = [];
        for (const pattern of tocPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                foundTocElements.push(...matches);
            }
        }
        
        console.log(`Found ${foundTocElements.length} TOC-like elements:`, foundTocElements);
        
        // Look for any links that might be to other blocks
        console.log('\n2b. Searching for links with similar ID patterns...');
        const linkPattern = /href="[^"]*\/content\/[^"]*\/(\d{7,})"/g;
        const foundLinks = [];
        let match;
        while ((match = linkPattern.exec(html)) !== null) {
            foundLinks.push({
                url: match[0],
                id: match[1]
            });
        }
        
        console.log(`Found ${foundLinks.length} links with 7+ digit IDs:`);
        foundLinks.forEach((link, i) => {
            console.log(`  ${i + 1}. ${link.url} (ID: ${link.id})`);
        });
        
        // Look for script tags that might contain block information
        console.log('\n2c. Searching for script tags with block data...');
        const scriptPattern = /<script[^>]*>(.*?)<\/script>/gs;
        const scripts = [];
        while ((match = scriptPattern.exec(html)) !== null) {
            const scriptContent = match[1];
            if (scriptContent.includes('5157') || scriptContent.includes('thumbview') || scriptContent.includes('block')) {
                scripts.push(scriptContent);
            }
        }
        
        console.log(`Found ${scripts.length} relevant scripts`);
        scripts.forEach((script, i) => {
            console.log(`\n  Script ${i + 1}:`);
            console.log(`    ${script.substring(0, 200)}${script.length > 200 ? '...' : ''}`);
        });
        
        // Look for any data attributes that might contain block information
        console.log('\n2d. Searching for data attributes with block info...');
        const dataPattern = /data-[^=]*="[^"]*515[^"]*"/g;
        const dataAttrs = [];
        while ((match = dataPattern.exec(html)) !== null) {
            dataAttrs.push(match[0]);
        }
        
        console.log(`Found ${dataAttrs.length} data attributes containing '515':`, dataAttrs);
        
        // Look for any JSON data structures
        console.log('\n2e. Searching for JSON data structures...');
        const jsonPattern = /\{[^}]*"[^"]*515[^"]*"[^}]*\}/g;
        const jsonMatches = [];
        while ((match = jsonPattern.exec(html)) !== null) {
            jsonMatches.push(match[0]);
        }
        
        console.log(`Found ${jsonMatches.length} JSON-like structures containing '515':`, jsonMatches);
        
        // Look for any table structures that might contain block information
        console.log('\n2f. Searching for table structures...');
        const tablePattern = /<table[^>]*>(.*?)<\/table>/gs;
        const tables = [];
        while ((match = tablePattern.exec(html)) !== null) {
            const tableContent = match[1];
            if (tableContent.includes('515') || tableContent.includes('thumbview') || tableContent.includes('[')) {
                tables.push(tableContent);
            }
        }
        
        console.log(`Found ${tables.length} relevant tables`);
        tables.forEach((table, i) => {
            console.log(`\n  Table ${i + 1}:`);
            console.log(`    ${table.substring(0, 300)}${table.length > 300 ? '...' : ''}`);
        });
        
        // Now let's test if we can derive other block IDs
        console.log('\n3. Testing block ID derivation...');
        
        const baseId = 5157616;
        const knownIds = [5157616, 5157228, 5157615];
        
        // Test sequential patterns
        console.log('\n3a. Testing sequential patterns around base ID...');
        const testIds = [];
        for (let i = -20; i <= 20; i++) {
            testIds.push(baseId + i);
        }
        
        console.log(`Testing ${testIds.length} sequential IDs around ${baseId}:`);
        for (const testId of testIds) {
            const testUrl = `https://www.e-manuscripta.ch/bau/content/thumbview/${testId}`;
            try {
                const testResponse = await fetch(testUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                    console.log(`  ✓ ${testId} - VALID`);
                } else {
                    console.log(`  ✗ ${testId} - ${testResponse.status}`);
                }
            } catch (error) {
                console.log(`  ✗ ${testId} - ERROR`);
            }
        }
        
        console.log('\n=== Deep Analysis Complete ===');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

deepAnalyzeEManuscripta().catch(console.error);