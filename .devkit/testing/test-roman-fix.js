const { SharedManifestLoaders } = require('../../dist/shared/SharedManifestLoaders');

async function testRomanArchive() {
    const loader = new SharedManifestLoaders();
    
    // Test manuscript 995-882
    console.log('Testing manuscript 995-882...');
    try {
        const url995 = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882';
        const manifest995 = await loader.getRomanArchiveManifest(url995);
        
        console.log('✓ Loaded manifest for 995-882');
        console.log('  Total images:', manifest995.images.length);
        
        // Check first few URLs to ensure they contain the correct manuscript number
        const first5Urls = manifest995.images.slice(0, 5).map(img => img.url);
        console.log('  First 5 URLs:');
        first5Urls.forEach(url => {
            const hasCorrectPath = url.includes('/995_');
            console.log(`    ${hasCorrectPath ? '✓' : '✗'} ${url.substring(url.indexOf('/preziosi/'), url.indexOf('&WID'))}`);
        });
        
        // Check for incorrect manuscript references
        const wrongManuscripts = manifest995.images.filter(img => 
            img.url.includes('/994_') || 
            img.url.includes('/996_')
        );
        
        if (wrongManuscripts.length > 0) {
            console.error('  ✗ ERROR: Found URLs with wrong manuscript numbers:', wrongManuscripts.length);
            wrongManuscripts.slice(0, 3).forEach(img => {
                console.error('    ', img.url.substring(img.url.indexOf('/preziosi/'), img.url.indexOf('&WID')));
            });
        } else {
            console.log('  ✓ All URLs contain correct manuscript number (995)');
        }
        
    } catch (error) {
        console.error('✗ Failed to load 995-882:', error.message);
    }
    
    console.log('\n---\n');
    
    // Test manuscript 994-882 
    console.log('Testing manuscript 994-882...');
    try {
        const url994 = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
        const manifest994 = await loader.getRomanArchiveManifest(url994);
        
        console.log('✓ Loaded manifest for 994-882');
        console.log('  Total images:', manifest994.images.length);
        
        // Check first few URLs
        const first5Urls = manifest994.images.slice(0, 5).map(img => img.url);
        console.log('  First 5 URLs:');
        first5Urls.forEach(url => {
            const hasCorrectPath = url.includes('/994_');
            console.log(`    ${hasCorrectPath ? '✓' : '✗'} ${url.substring(url.indexOf('/preziosi/'), url.indexOf('&WID'))}`);
        });
        
        // Check for incorrect manuscript references
        const wrongManuscripts = manifest994.images.filter(img => 
            img.url.includes('/995_') || 
            img.url.includes('/993_')
        );
        
        if (wrongManuscripts.length > 0) {
            console.error('  ✗ ERROR: Found URLs with wrong manuscript numbers:', wrongManuscripts.length);
            wrongManuscripts.slice(0, 3).forEach(img => {
                console.error('    ', img.url.substring(img.url.indexOf('/preziosi/'), img.url.indexOf('&WID')));
            });
        } else {
            console.log('  ✓ All URLs contain correct manuscript number (994)');
        }
        
    } catch (error) {
        console.error('✗ Failed to load 994-882:', error.message);
    }
}

testRomanArchive().catch(console.error);