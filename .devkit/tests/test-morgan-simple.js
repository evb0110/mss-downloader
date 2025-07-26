// Simple test to verify Morgan Library fix
const https = require('https');

async function testMorganExtraction(url) {
    console.log('\n🔍 Testing Morgan Library extraction');
    console.log('URL:', url);
    console.log('-'.repeat(60));
    
    // Step 1: Fetch the main page (NOT /thumbs)
    const response = await fetch(url.replace('/thumbs', ''));
    const html = await response.text();
    
    // Step 2: Extract manuscript ID
    const manuscriptMatch = url.match(/\/collection\/([^/]+)/);
    if (!manuscriptMatch) {
        console.log('❌ Could not extract manuscript ID');
        return;
    }
    
    const manuscriptId = manuscriptMatch[1];
    console.log('📚 Manuscript ID:', manuscriptId);
    
    // Step 3: Find individual page references
    const pageUrlRegex = new RegExp(`\\/collection\\/${manuscriptId}\\/(\\d+)`, 'g');
    const pageMatches = [...html.matchAll(pageUrlRegex)];
    const uniquePages = [...new Set(pageMatches.map(match => match[1]))];
    
    console.log(`✅ Found ${uniquePages.length} individual pages`);
    
    if (uniquePages.length > 1) {
        console.log('   Pages:', uniquePages.slice(0, 10).join(', ') + (uniquePages.length > 10 ? '...' : ''));
        console.log('\n✅ FIX SUCCESSFUL: Multiple pages found!');
        console.log('   (Previously would only find 1 page)');
    } else {
        console.log('\n❌ ISSUE PERSISTS: Still only finding 1 page');
    }
    
    // Step 4: Test fetching an individual page
    if (uniquePages.length > 0) {
        console.log('\n📄 Testing individual page fetch...');
        const testPageUrl = `https://www.themorgan.org/collection/${manuscriptId}/${uniquePages[0]}`;
        console.log('   URL:', testPageUrl);
        
        const pageResponse = await fetch(testPageUrl);
        const pageHtml = await pageResponse.text();
        
        // Look for facsimile images
        const facsimileMatch = pageHtml.match(/\/sites\/default\/files\/facsimile\/[^"']+\.jpg/);
        if (facsimileMatch) {
            console.log('   ✅ Found facsimile image:', facsimileMatch[0]);
        } else {
            console.log('   ❌ No facsimile image found');
        }
    }
}

// Test URLs
const testUrls = [
    'https://www.themorgan.org/collection/lindau-gospels',
    'https://www.themorgan.org/collection/arenberg-gospels'
];

async function runTests() {
    console.log('🧪 Morgan Library Fix Verification\n');
    console.log('Expected: Multiple pages (16 for Lindau, 12 for Arenberg)');
    console.log('Bug behavior: Only 1 page');
    console.log('=' .repeat(60));
    
    for (const url of testUrls) {
        await testMorganExtraction(url);
        console.log('\n' + '='.repeat(60));
    }
}

runTests().catch(console.error);