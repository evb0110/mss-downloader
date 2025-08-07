const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFlorence() {
    console.log('🔬 ULTRA-DEEP Florence Library Testing');
    console.log('=======================================');
    
    const loader = new SharedManifestLoaders();
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    console.log(`Testing URL: ${testUrl}`);
    console.log('');
    
    // Test 1: Network connectivity
    console.log('Test 1: Network Connectivity');
    console.log('----------------------------');
    try {
        const response = await fetch(testUrl, {
            method: 'HEAD',
            timeout: 10000
        });
        console.log(`✅ Network accessible: Status ${response.status}`);
    } catch (error) {
        console.log(`❌ Network error: ${error.message}`);
        if (error.code === 'ETIMEDOUT') {
            console.log('   -> Server is timing out (possibly geo-blocked)');
        }
    }
    
    // Test 2: Try parsing with production code
    console.log('\nTest 2: Production Code Parsing');
    console.log('--------------------------------');
    try {
        const result = await loader.parseUrl(testUrl);
        console.log('✅ Parsing successful!');
        console.log(`   Display Name: ${result.displayName}`);
        console.log(`   Images found: ${result.images ? result.images.length : 0}`);
        if (result.images && result.images.length > 0) {
            console.log(`   First image: ${result.images[0].url}`);
        }
    } catch (error) {
        console.log(`❌ Parsing failed: ${error.message}`);
        console.log(`   Error type: ${error.code || 'Unknown'}`);
    }
    
    // Test 3: Direct IIIF access
    console.log('\nTest 3: Direct IIIF Access');
    console.log('---------------------------');
    const iiifUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:317515/full/max/0/default.jpg';
    try {
        const response = await fetch(iiifUrl, {
            method: 'HEAD',
            timeout: 10000
        });
        console.log(`✅ IIIF endpoint accessible: Status ${response.status}`);
    } catch (error) {
        console.log(`❌ IIIF access failed: ${error.message}`);
    }
    
    // Test 4: Check if manifest exists
    console.log('\nTest 4: IIIF Manifest Check');
    console.log('----------------------------');
    const manifestUrl = 'https://cdm21059.contentdm.oclc.org/iiif/info/plutei/317515/manifest.json';
    try {
        const response = await fetch(manifestUrl, {
            timeout: 10000
        });
        if (response.ok) {
            const manifest = await response.json();
            console.log(`✅ Manifest found: ${manifest['@id'] || manifest.id}`);
        } else {
            console.log(`❌ Manifest not available: Status ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Manifest fetch failed: ${error.message}`);
    }
}

testFlorence().catch(console.error);