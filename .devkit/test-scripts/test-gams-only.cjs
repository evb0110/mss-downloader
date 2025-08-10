const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const manifestLoaders = new SharedManifestLoaders();

async function testGAMS() {
    const url = 'https://gams.uni-graz.at/archive/objects/o:szd.2728/sdef:IIIF/manifest';
    console.log('Testing GAMS URL:', url);
    
    try {
        const manifest = await manifestLoaders.getManifestForLibrary('gams', url);
        const pages = manifest?.images || manifest?.pages;
        
        if (pages && pages.length > 0) {
            console.log(`✅ SUCCESS: Loaded ${pages.length} pages`);
            console.log('First page:', pages[0]);
            console.log('Last page:', pages[pages.length - 1]);
        } else {
            console.log('❌ FAILED: No pages found');
        }
    } catch (error) {
        console.log('❌ FAILED:', error.message);
    }
}

testGAMS();
