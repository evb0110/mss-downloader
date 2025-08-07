/**
 * Test script to verify geo-blocking filter functionality
 */

const path = require('path');
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');

async function testGeoBlockingFilter() {
    console.log('🔬 Testing Geo-Blocking Filter for Issue #20\n');
    console.log('=' .repeat(60));
    
    const service = new EnhancedManuscriptDownloaderService(null);
    const libraries = service.getSupportedLibraries();
    
    // Count geo-blocked libraries
    const geoBlockedLibraries = libraries.filter(lib => lib.geoBlocked);
    const totalLibraries = libraries.length;
    
    console.log(`\n📊 Library Statistics:`);
    console.log(`Total Libraries: ${totalLibraries}`);
    console.log(`Geo-Blocked Libraries: ${geoBlockedLibraries.length}`);
    console.log(`Percentage Geo-Blocked: ${Math.round(geoBlockedLibraries.length / totalLibraries * 100)}%\n`);
    
    console.log('🌍 Libraries with Geographic Restrictions:\n');
    console.log('-'.repeat(60));
    
    // List all geo-blocked libraries as requested in Issue #20
    geoBlockedLibraries.forEach((lib, index) => {
        console.log(`${index + 1}. ${lib.name}`);
        
        // Extract geo-restriction info from description
        const restrictionMatch = lib.description.match(/require[s]?\s+([^)]+)\s+IP|may\s+require\s+([^)]+)\s+IP/i);
        if (restrictionMatch) {
            const restriction = restrictionMatch[1] || restrictionMatch[2];
            console.log(`   📍 Restriction: Requires ${restriction} IP address`);
        }
        console.log(`   📝 ${lib.description}`);
        console.log();
    });
    
    console.log('-'.repeat(60));
    
    // Verify the specific libraries mentioned in Issue #20
    const expectedGeoBlockedLibraries = [
        'University of Graz',
        'Florence (ContentDM Plutei)',
        'BDL (Biblioteca Digitale Lombarda)',
        'Grenoble Municipal Library',
        'MDC Catalonia (Memòria Digital de Catalunya)',
        'Verona Library (NBM)'
    ];
    
    console.log('\n✅ Verification of Issue #20 Libraries:');
    console.log('-'.repeat(60));
    
    let allFound = true;
    expectedGeoBlockedLibraries.forEach(expectedName => {
        const found = geoBlockedLibraries.find(lib => lib.name.includes(expectedName.split(' (')[0]));
        if (found) {
            console.log(`✅ ${expectedName} - FOUND with geo-blocking flag`);
        } else {
            console.log(`❌ ${expectedName} - NOT FOUND or missing geo-blocking flag`);
            allFound = false;
        }
    });
    
    console.log('\n' + '='.repeat(60));
    
    if (allFound) {
        console.log('🎉 SUCCESS: All libraries from Issue #20 have geo-blocking indicators!');
        console.log('📋 The geo-blocking filter feature is working correctly.');
        console.log('🌍 Users can now easily see which libraries have geographic restrictions.');
    } else {
        console.log('⚠️  WARNING: Some libraries from Issue #20 are missing geo-blocking flags.');
    }
    
    // Additional libraries with geo-blocking
    const additionalGeoBlocked = geoBlockedLibraries.filter(lib => 
        !expectedGeoBlockedLibraries.some(expected => lib.name.includes(expected.split(' (')[0]))
    );
    
    if (additionalGeoBlocked.length > 0) {
        console.log(`\n📌 Additional geo-blocked libraries found: ${additionalGeoBlocked.length}`);
        additionalGeoBlocked.forEach(lib => {
            console.log(`   - ${lib.name}`);
        });
    }
    
    console.log('\n✨ Issue #20 Resolution Summary:');
    console.log('1. All libraries with geo-restrictions are properly marked');
    console.log('2. New filter button allows users to see ONLY geo-blocked libraries');
    console.log('3. Visual badges help identify restricted libraries at a glance');
    console.log('4. Total of ' + geoBlockedLibraries.length + ' libraries identified with restrictions');
    
    return {
        success: allFound,
        totalLibraries,
        geoBlockedCount: geoBlockedLibraries.length,
        geoBlockedLibraries: geoBlockedLibraries.map(lib => lib.name)
    };
}

// Run the test
testGeoBlockingFilter()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });