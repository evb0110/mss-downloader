const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');

// Test the EXACT URL from user's bug report
const testUrl = 'https://gams.uni-graz.at/context:rbas.ms.P0008s11';

async function testGrazContextUrl() {
    console.log('Testing Graz context URL pattern...\n');
    
    const loaders = new SharedManifestLoaders();
    
    try {
        console.log('Testing URL:', testUrl);
        console.log('Starting manifest load...\n');
        
        const startTime = Date.now();
        
        // Set a reasonable timeout for the test
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000);
        });
        
        const manifest = await Promise.race([
            loaders.getGrazManifest(testUrl),
            timeoutPromise
        ]);
        
        const elapsed = Date.now() - startTime;
        
        console.log(`\nManifest loaded successfully in ${(elapsed / 1000).toFixed(1)} seconds`);
        console.log('Total pages found:', manifest.images.length);
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error('\nFull error:', error);
        console.error('\nThis is the exact URL pattern the user reported as failing\!');
    }
}

// Run the test
testGrazContextUrl().catch(console.error);
