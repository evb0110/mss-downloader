#!/usr/bin/env node

/**
 * Simple test to check e-manuscripta.ch page detection
 */

async function testEManuscriptaPageDetection() {
    console.log('🔍 Testing e-manuscripta.ch page detection...\n');
    
    const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';
    
    try {
        console.log('📡 Fetching manuscript page...');
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            console.log(`❌ Failed to fetch page: HTTP ${response.status}`);
            return;
        }
        
        const html = await response.text();
        console.log(`✅ Page fetched successfully (${html.length} chars)`);
        
        // Test dropdown parsing
        console.log('\n🔍 Testing dropdown parsing...');
        const selectStart = html.indexOf('<select id="goToPage"');
        const selectEnd = html.indexOf('</select>', selectStart);
        
        if (selectStart === -1 || selectEnd === -1) {
            console.log('❌ goToPage select element not found');
            return;
        }
        
        const selectElement = html.substring(selectStart, selectEnd + 9);
        console.log(`✅ Found goToPage select element (${selectElement.length} chars)`);
        
        // Parse options
        const optionRegex = /<option\s+value="(\d+)"\s*>\s*\[(\d+)\]\s*/g;
        const pageMatches = Array.from(selectElement.matchAll(optionRegex));
        
        console.log(`\n📊 Found ${pageMatches.length} page options`);
        
        if (pageMatches.length > 0) {
            const pageData = pageMatches.map(match => ({
                id: match[1],
                pageNumber: parseInt(match[2], 10)
            }));
            
            pageData.sort((a, b) => a.pageNumber - b.pageNumber);
            
            console.log(`📄 Page range: [${pageData[0].pageNumber}] to [${pageData[pageData.length - 1].pageNumber}]`);
            console.log(`🔗 First page ID: ${pageData[0].id}`);
            console.log(`🔗 Last page ID: ${pageData[pageData.length - 1].id}`);
            
            // Test a few image URLs
            console.log('\n🧪 Testing image URLs...');
            const testPages = [pageData[0], pageData[Math.floor(pageData.length / 2)], pageData[pageData.length - 1]];
            
            for (const page of testPages) {
                const imageUrl = `https://www.e-manuscripta.ch/zuzcmi/download/webcache/0/${page.id}`;
                try {
                    const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                    const status = imageResponse.ok ? '✅' : '❌';
                    console.log(`${status} Page [${page.pageNumber}] (ID: ${page.id}): HTTP ${imageResponse.status}`);
                } catch (error) {
                    console.log(`❌ Page [${page.pageNumber}] (ID: ${page.id}): ${error.message}`);
                }
            }
            
            if (pageData.length >= 400) {
                console.log('\n🎉 SUCCESS: e-manuscripta.ch page detection is working correctly!');
                console.log(`   Found ${pageData.length} pages (expected ~463)`);
            } else {
                console.log('\n⚠️ PARTIAL SUCCESS: Found some pages but fewer than expected');
                console.log(`   Found ${pageData.length} pages (expected ~463)`);
            }
        } else {
            console.log('❌ No page options found - parsing failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testEManuscriptaPageDetection().catch(console.error);