#!/usr/bin/env node

async function testEManuscriptaFix() {
    console.log('=== TESTING E-MANUSCRIPTA FIX ===');
    
    const testUrls = [
        'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            // Test the fixed dropdown detection
            const selectMatch = html.match(/<select[^>]*id="goToPages"[^>]*>.*?<\/select>/s);
            if (selectMatch) {
                const selectHtml = selectMatch[0];
                const optionRegex = /option value="(\d+)"/g;
                const pageIds = [];
                let match;
                while ((match = optionRegex.exec(selectHtml)) !== null) {
                    pageIds.push(match[1]);
                }
                console.log(`✓ Found ${pageIds.length} pages in dropdown`);
                if (pageIds.length > 0) {
                    console.log(`  First 5 page IDs: ${pageIds.slice(0, 5).join(', ')}`);
                    console.log(`  Last 5 page IDs: ${pageIds.slice(-5).join(', ')}`);
                }
            } else {
                console.log('✗ No goToPages dropdown found');
            }
            
        } catch (error) {
            console.error(`Error testing ${url}:`, error.message);
        }
    }
}

testEManuscriptaFix();