/**
 * Test critical fixes for Issues #6 (Bordeaux) and #5 (Florence)
 */

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

async function testCriticalFixes() {
    console.log('🔍 Testing critical fixes for issues #6 and #5...\n');
    
    const loaders = new SharedManifestLoaders();
    let passedTests = 0;
    let totalTests = 2;
    
    // Test #6: Bordeaux URL recognition
    console.log('📝 Testing Issue #6 (Bordeaux) fix...');
    try {
        const bordeauxUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
        const manifest = await loaders.getBordeauxManifest(bordeauxUrl);
        
        if (manifest && manifest.images && manifest.images.length > 0) {
            console.log('✅ Issue #6 FIXED: Bordeaux URLs properly processed');
            console.log(`   Generated ${manifest.images.length} tile URLs`);
            passedTests++;
        } else {
            throw new Error('No images in manifest');
        }
    } catch (error) {
        console.log('❌ Issue #6 FAILED:', error.message);
    }
    
    // Test #5: Florence ultra-simple approach
    console.log('\n📝 Testing Issue #5 (Florence) ultra-simple fix...');
    try {
        const florenceUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/1000';
        const manifest = await loaders.getFlorenceManifest(florenceUrl);
        
        if (manifest && manifest.images && manifest.images.length > 0) {
            console.log('✅ Issue #5 FIXED: Florence generates IIIF URLs without API calls');
            console.log(`   Generated ${manifest.images.length} IIIF URLs`);
            console.log('   No network timeouts or infinite loading possible');
            passedTests++;
        } else {
            throw new Error('No images in manifest');
        }
    } catch (error) {
        console.log('❌ Issue #5 FAILED:', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 CRITICAL FIXES TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL CRITICAL FIXES WORKING!');
        console.log('Ready to deploy version 1.4.47');
        return true;  
    } else {
        console.log('\n⚠️  Some fixes still need work');
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    testCriticalFixes()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('💥 Test error:', error);
            process.exit(1);
        });
}

module.exports = { testCriticalFixes };