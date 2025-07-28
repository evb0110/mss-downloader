const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

// Test URLs for HHU and Graz
const testUrls = {
    hhu: [
        // Valid working URLs from web search
        'https://digital.ulb.hhu.de/ink/content/titleinfo/2310083',
        'https://digital.ulb.hhu.de/ihd/content/titleinfo/10147625',
        'https://digital.ulb.hhu.de/content/titleinfo/661008'
    ],
    graz: [
        // University Library Graz (unipub) - these should work
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
        'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'
    ],
    gams: [
        // GAMS context URLs - not currently supported by the implementation
        'https://gams.uni-graz.at/context:rbas.ms.P0008s11',
        'https://gams.uni-graz.at/context:corema.a1'
    ]
};

async function testLibraryUrls(libraryName, urls, loaderMethod) {
    console.log(`\n=== Testing ${libraryName.toUpperCase()} URLs ===\n`);
    const loaders = new SharedManifestLoaders();
    
    for (const url of urls) {
        console.log(`Testing: ${url}`);
        try {
            const startTime = Date.now();
            
            // Set timeout for slow servers
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout after 60 seconds')), 60000);
            });
            
            const manifest = await Promise.race([
                loaders[loaderMethod](url),
                timeoutPromise
            ]);
            
            const elapsed = Date.now() - startTime;
            console.log(`✓ Success in ${(elapsed / 1000).toFixed(1)}s - Found ${manifest.images.length} pages`);
            if (manifest.displayName) {
                console.log(`  Title: ${manifest.displayName}`);
            }
            
        } catch (error) {
            console.log(`✗ Failed: ${error.message}`);
        }
        console.log('');
    }
}

async function runTests() {
    console.log('Valid Test URLs Verification');
    console.log('============================');
    
    // Test HHU
    await testLibraryUrls('HHU', testUrls.hhu, 'getHHUManifest');
    
    // Test University Library Graz
    await testLibraryUrls('University Library Graz', testUrls.graz, 'getGrazManifest');
    
    // Test GAMS (will fail as not supported)
    console.log('\n=== Testing GAMS Context URLs (Not Supported) ===\n');
    console.log('Note: These GAMS context URLs are not supported by current implementation');
    for (const url of testUrls.gams) {
        console.log(`- ${url}`);
    }
    
    console.log('\nTest complete!');
}

// Run tests
runTests().catch(console.error);