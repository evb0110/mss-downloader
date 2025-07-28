const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testMorgan() {
    const loaders = new SharedManifestLoaders();
    console.log('\nTesting Morgan Library with SharedManifestLoaders...');
    
    try {
        const url = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        console.log('URL:', url);
        
        const manifest = await loaders.getMorganManifest(url);
        
        console.log('\nManifest loaded successfully!');
        console.log('Title:', manifest.displayName);
        console.log('Total pages found:', manifest.images.length);
        
        // Show first 10 image URLs
        console.log('\nFirst 10 image URLs:');
        for (let i = 0; i < Math.min(10, manifest.images.length); i++) {
            console.log(`  ${i + 1}. ${manifest.images[i].label}: ${manifest.images[i].url}`);
        }
        
        // Check uniqueness
        const uniqueUrls = new Set(manifest.images.map(img => img.url));
        console.log(`\nUnique URLs: ${uniqueUrls.size} / ${manifest.images.length}`);
        
        if (manifest.images.length === 1) {
            console.error('\n❌ FAILED: Only 1 page found!');
            process.exit(1);
        }
        
        if (uniqueUrls.size === 1) {
            console.error('\n❌ FAILED: All pages have the same URL!');
            process.exit(1);
        }
        
        console.log('\n✓ Morgan Library implementation working correctly!');
        console.log(`✓ Found ${manifest.images.length} pages with ${uniqueUrls.size} unique URLs`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

testMorgan();