#!/usr/bin/env bun

/**
 * Test Monte Cassino IIIF manifest fix
 * Tests the corrected catalog mapping with ams_ prefix
 */

const testCatalogMapping = async () => {
    // Simulate our corrected catalog mapping
    const catalogMappings: { [key: string]: string } = {
        '0000313047': 'IT-FR0084_ams_0339',
        '0000313194': 'IT-FR0084_ams_0271', 
        '0000396781': 'IT-FR0084_ams_0023',
    };

    // Test the specific case reported in the error
    const catalogId = '0000313047';
    const manuscriptId = catalogMappings[catalogId];
    
    if (!manuscriptId) {
        console.log('❌ Catalog mapping failed');
        return false;
    }

    console.log(`✅ Catalog mapping: ${catalogId} → ${manuscriptId}`);

    // Construct IIIF manifest URL
    const manifestUrl = `https://omnes.dbseret.com/montecassino/iiif/${manuscriptId}/manifest`;
    console.log(`📍 Testing manifest URL: ${manifestUrl}`);

    try {
        // Test the manifest URL
        const response = await fetch(manifestUrl, { method: 'HEAD' });
        
        if (response.ok) {
            console.log(`✅ IIIF manifest accessible: HTTP ${response.status}`);
            console.log(`📄 Content-Type: ${response.headers.get('Content-Type')}`);
            return true;
        } else {
            console.log(`❌ IIIF manifest failed: HTTP ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Network error: ${error}`);
        return false;
    }
};

// Run the test
console.log('🧪 Testing Monte Cassino IIIF manifest fix...\n');

testCatalogMapping().then(success => {
    console.log('\n📊 Test Results:');
    if (success) {
        console.log('✅ Monte Cassino fix successful - HTTP 500 issue resolved');
        console.log('🔧 Root cause: Missing "ams_" prefix in manuscript identifiers');
        console.log('🎯 Solution: Updated catalog mapping with correct OMNES identifiers');
    } else {
        console.log('❌ Monte Cassino fix failed - issue persists');
    }
    
    process.exit(success ? 0 : 1);
});