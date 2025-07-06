const { spawn } = require('child_process');

// Test DIAMM implementation with the provided URLs
const testUrls = [
    'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
    'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Ra-Ms1383%2Fmanifest.json',
    'https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json',
    'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json'
];

console.log('🔍 Testing DIAMM implementation...');

function testDiammUrl(url, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n📋 Testing URL ${index + 1}/${testUrls.length}:`);
        console.log(`   ${url}`);
        
        const child = spawn('node', ['-e', `
            const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');
            const service = new EnhancedManuscriptDownloaderService();
            
            async function test() {
                try {
                    const library = service.detectLibrary('${url}');
                    console.log('✅ Library detected:', library);
                    
                    if (library === 'diamm') {
                        console.log('🎵 DIAMM library correctly identified');
                        
                        const manifest = await service.loadManifest('${url}');
                        console.log('✅ Manifest loaded successfully');
                        console.log('📄 Pages:', manifest.totalPages);
                        console.log('📖 Display name:', manifest.displayName);
                        console.log('🏛️ Library:', manifest.library);
                        
                        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
                            console.log('🖼️ First page URL:', manifest.pageLinks[0].substring(0, 100) + '...');
                        }
                        
                        process.exit(0);
                    } else {
                        console.log('❌ Wrong library detected:', library);
                        process.exit(1);
                    }
                } catch (error) {
                    console.error('❌ Error:', error.message);
                    process.exit(1);
                }
            }
            
            test();
        `], { stdio: 'inherit' });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Test ${index + 1} passed`);
                resolve();
            } else {
                console.log(`❌ Test ${index + 1} failed`);
                reject(new Error(`Test failed with code ${code}`));
            }
        });
    });
}

async function runTests() {
    try {
        for (let i = 0; i < testUrls.length; i++) {
            await testDiammUrl(testUrls[i], i);
        }
        
        console.log('\n🎉 All DIAMM tests passed!');
        console.log('✅ DIAMM implementation is working correctly');
        
    } catch (error) {
        console.error('\n❌ Tests failed:', error.message);
        process.exit(1);
    }
}

runTests();