#!/usr/bin/env node

// Test URL pattern extraction for Belgica KBR multi-page discovery

function testUrlPattern() {
    console.log('Testing Belgica KBR URL pattern extraction...');
    
    const testUrl = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0007/';
    
    console.log(`\nInput URL: ${testUrl}`);
    
    // Test the new URL parsing logic from the updated code
    const urlParts = testUrl.split('/');
    const zoomtilesIndex = urlParts.indexOf('zoomtiles');
    
    console.log('\nURL analysis:');
    console.log('URL parts:', urlParts);
    console.log(`zoomtiles found at index: ${zoomtilesIndex}`);
    
    if (zoomtilesIndex === -1 || zoomtilesIndex >= urlParts.length - 1) {
        console.log('\n❌ Could not find zoomtiles pattern in URL');
        return;
    }
    
    const manuscriptId = urlParts[zoomtilesIndex + 1];
    const baseUrlParts = urlParts.slice(0, zoomtilesIndex + 1);
    const baseUrlPattern = baseUrlParts.join('/') + '/';
    
    console.log(`\nManuscript ID: ${manuscriptId}`);
    console.log(`Base URL pattern: ${baseUrlPattern}`);
    
    // Parse manuscript ID: BE-KBR00_A-1589485_0000-00-00_00_0007
    // Format: BE-KBR00_{collection}-{document}_{date}_{page}
    const idMatch = manuscriptId.match(/^(BE-KBR00_[^_]+_[^_]+_[^_]+_)(\d{4})$/);
    
    if (!idMatch) {
        console.log(`\n❌ Could not parse manuscript ID pattern: ${manuscriptId}`);
        
        // Try to understand the actual structure
        console.log('\nManuscript ID parts:');
        const idParts = manuscriptId.split('_');
        idParts.forEach((part, index) => {
            console.log(`  Part ${index}: ${part}`);
        });
        return;
    }
    
    const manuscriptBaseId = idMatch[1];
    const currentPageNum = parseInt(idMatch[2]);
    
    console.log('\n✅ URL pattern extraction successful:');
    console.log(`  Base URL pattern: ${baseUrlPattern}`);
    console.log(`  Manuscript base ID: ${manuscriptBaseId}`);
    console.log(`  Current page number: ${currentPageNum}`);
    
    // Generate sample page URLs
    console.log('\nSample generated page URLs:');
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const pageId = `${manuscriptBaseId}${pageNum.toString().padStart(4, '0')}`;
        const pageUrl = `${baseUrlPattern}${pageId}/`;
        console.log(`  Page ${pageNum}: ${pageUrl}`);
    }
    
    // Generate corresponding tile URLs for testing
    console.log('\nSample tile URLs (for testing page existence):');
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
        const pageId = `${manuscriptBaseId}${pageNum.toString().padStart(4, '0')}`;
        const pageUrl = `${baseUrlPattern}${pageId}/`;
        const tileUrl = `${pageUrl}3-0-0.jpg`;
        console.log(`  Page ${pageNum} test tile: ${tileUrl}`);
    }
    
    console.log('\n✅ URL pattern extraction and generation working correctly!');
    console.log('This should allow discovery of multiple pages by testing sequential page numbers.');
}

testUrlPattern();