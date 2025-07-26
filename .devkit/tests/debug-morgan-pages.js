async function debugMorganPages() {
    console.log('🔍 Debugging Morgan Library page structure...\n');
    
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/1';
    
    console.log(`Fetching: ${testUrl}`);
    const response = await fetch(testUrl);
    const html = await response.text();
    
    console.log('\nSearching for image patterns:');
    
    // Pattern 1: Facsimile images
    const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
    const facsimileMatches = html.match(facsimileRegex) || [];
    console.log(`\n1. Facsimile images (${facsimileMatches.length} found):`);
    facsimileMatches.forEach(match => console.log(`   ${match}`));
    
    // Pattern 2: Collection images
    const collectionRegex = /\/sites\/default\/files\/images\/collection\/[^"']+\.jpg/g;
    const collectionMatches = html.match(collectionRegex) || [];
    console.log(`\n2. Collection images (${collectionMatches.length} found):`);
    collectionMatches.forEach(match => console.log(`   ${match}`));
    
    // Pattern 3: Styled images
    const styledRegex = /\/sites\/default\/files\/styles\/[^"']+\.jpg/g;
    const styledMatches = html.match(styledRegex) || [];
    console.log(`\n3. Styled images (${styledMatches.length} found):`);
    styledMatches.slice(0, 5).forEach(match => console.log(`   ${match}`));
    if (styledMatches.length > 5) console.log(`   ... and ${styledMatches.length - 5} more`);
    
    // Pattern 4: Any .jpg files
    const anyJpgRegex = /[^"']+\.jpg/g;
    const anyJpgMatches = html.match(anyJpgRegex) || [];
    console.log(`\n4. Total .jpg files found: ${anyJpgMatches.length}`);
    
    // Look for the actual high-res image
    console.log('\n5. Looking for specific patterns:');
    
    // Test actual download
    if (facsimileMatches.length > 0) {
        const testImageUrl = `https://www.themorgan.org${facsimileMatches[0]}`;
        console.log(`\nTesting download: ${testImageUrl}`);
        try {
            const imgResponse = await fetch(testImageUrl);
            console.log(`Response status: ${imgResponse.status}`);
            if (imgResponse.ok) {
                const contentLength = imgResponse.headers.get('content-length');
                console.log(`Content-Length: ${(parseInt(contentLength) / 1024).toFixed(2)} KB`);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}

debugMorganPages().catch(console.error);