
const fetch = require('node-fetch');

async function analyzeBlocks() {
    const results = [];
    
    for (const url of ["https://www.e-manuscripta.ch/bau/content/titleinfo/5157222","https://www.e-manuscripta.ch/bau/content/thumbview/5157616","https://www.e-manuscripta.ch/bau/content/thumbview/5157228","https://www.e-manuscripta.ch/bau/content/thumbview/5157615"]) {
        try {
            console.log('\n🔍 Fetching:', url);
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('❌ Failed to fetch:', response.status, response.statusText);
                continue;
            }
            
            const html = await response.text();
            
            // Extract page information
            const pageInfo = {
                url: url,
                type: getUrlType(url),
                title: extractTitle(html),
                pageRange: extractPageRange(html),
                blocks: extractBlocks(html),
                hasDropdown: html.includes('id="goToPage"'),
                hasThumbView: html.includes('thumbview'),
                hasZoomView: html.includes('zoom')
            };
            
            console.log('📄 Title:', pageInfo.title);
            console.log('📊 Page Range:', pageInfo.pageRange);
            console.log('🧩 Blocks Found:', pageInfo.blocks.length);
            console.log('📋 Has Dropdown:', pageInfo.hasDropdown);
            console.log('🖼️ Has Thumb View:', pageInfo.hasThumbView);
            console.log('🔍 Has Zoom View:', pageInfo.hasZoomView);
            
            results.push(pageInfo);
            
        } catch (error) {
            console.log('❌ Error fetching', url, ':', error.message);
        }
    }
    
    return results;
}

function getUrlType(url) {
    if (url.includes('titleinfo')) return 'titleinfo';
    if (url.includes('thumbview')) return 'thumbview';
    if (url.includes('zoom')) return 'zoom';
    return 'unknown';
}

function extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'No title found';
}

function extractPageRange(html) {
    // Look for page range patterns like [1-20], [8-27], etc.
    const rangePatterns = [
        /\[(\d+)-(\d+)\]/g,
        /pages?\s+(\d+)\s*-\s*(\d+)/gi,
        /\((\d+)\s*-\s*(\d+)\)/g
    ];
    
    const ranges = [];
    for (const pattern of rangePatterns) {
        const matches = Array.from(html.matchAll(pattern));
        ranges.push(...matches.map(m => `[${m[1]}-${m[2]}]`));
    }
    
    return [...new Set(ranges)]; // Remove duplicates
}

function extractBlocks(html) {
    // Look for block/section patterns
    const blockPatterns = [
        /Universitätsbibliothek Basel[^\[]*\[(\d+)-(\d+)\]/g,
        /Statuta et Consuetudines[^\[]*\[(\d+)-(\d+)\]/g,
        /href="[^"]*content\/(thumbview|zoom)\/(\d+)"/g
    ];
    
    const blocks = [];
    for (const pattern of blockPatterns) {
        const matches = Array.from(html.matchAll(pattern));
        blocks.push(...matches.map(m => ({
            type: m[1] || 'range',
            id: m[2] || m[1],
            range: m[3] ? `[${m[1]}-${m[3]}]` : null
        })));
    }
    
    return blocks;
}

analyzeBlocks().then(results => {
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log('='.repeat(50));
    
    results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.type.toUpperCase()} URL:`);
        console.log(`   Title: ${result.title}`);
        console.log(`   Page Ranges: ${result.pageRange.join(', ')}`);
        console.log(`   Blocks: ${result.blocks.length}`);
        console.log(`   Features: ${[
            result.hasDropdown ? 'dropdown' : null,
            result.hasThumbView ? 'thumbview' : null,
            result.hasZoomView ? 'zoom' : null
        ].filter(Boolean).join(', ')}`);
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('1. Check if titleinfo URL contains links to all blocks');
    console.log('2. Verify if thumbview URLs represent different page ranges');
    console.log('3. Test if zoom URLs need to be generated from blocks');
    console.log('4. Implement block detection and aggregation logic');
});
