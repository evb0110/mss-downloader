const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function quickValidateAll() {
    console.log('=== Quick Validation of All Issues ===\n');
    
    const tests = [
        { issue: 1, library: 'duesseldorf', url: 'https://digital.ub.uni-duesseldorf.de/dfgviewer/show/?set%5Bmets%5D=https%3A%2F%2Fdigital.ub.uni-duesseldorf.de%2Foai%2F%3Fverb%3DGetRecord%26metadataPrefix%3Dmets%26identifier%3D6070262' },
        { issue: 2, library: 'graz', url: 'https://digital.ub.uni-graz.at/de/o:depcha.book.1304' },
        { issue: 3, library: 'verona', url: 'https://archive.org/details/ZCIV8' },
        { issue: 4, library: 'morgan', url: 'https://www.themorgan.org/manuscript/77450' },
        { issue: 5, library: 'florence', url: 'https://teca.bmlonline.it/ImageViewer/servlet/ImageViewer?idr=BNCF0003328817' }
    ];
    
    const loaders = new SharedManifestLoaders();
    let passedTests = 0;
    
    for (const test of tests) {
        try {
            console.log(`Testing Issue #${test.issue} (${test.library})...`);
            const manifest = await loaders.getManifestForLibrary(test.library, test.url);
            
            if (manifest && manifest.images && manifest.images.length > 0) {
                console.log(`  ✅ PASS: Found ${manifest.images.length} pages`);
                passedTests++;
            } else {
                console.log(`  ❌ FAIL: No images found`);
            }
        } catch (error) {
            console.log(`  ❌ FAIL: ${error.message}`);
        }
    }
    
    console.log(`\n=== Results: ${passedTests}/${tests.length} tests passed ===`);
    return passedTests === tests.length;
}

quickValidateAll().then(success => {
    process.exit(success ? 0 : 1);
});