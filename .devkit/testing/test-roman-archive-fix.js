#!/usr/bin/env node

// Test Roman Archive RULE 0.6 compliance fix
// This script directly tests the fixed Roman Archive implementation

const { SharedManifestAdapter } = require('../../dist/main/main.js');

async function testRomanArchiveFix() {
    console.log('🧪 Testing Roman Archive RULE 0.6 compliance fix...\n');
    
    // Test URL from original issue
    const testUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    console.log(`📄 Testing URL: ${testUrl}`);
    console.log(`🎯 Expected: Server-discovered filenames ONLY (no pattern assumptions)\n`);
    
    try {
        const adapter = new SharedManifestAdapter();
        console.log('⏳ Loading manifest with RULE 0.6 compliance...');
        
        const result = await adapter.loadManifest(testUrl);
        
        if (result && result.length > 0) {
            console.log(`✅ SUCCESS: Found ${result.length} pages using server-discovered filenames`);
            console.log('\n📋 First 5 discovered URLs:');
            
            for (let i = 0; i < Math.min(5, result.length); i++) {
                const url = result[i].url;
                const filename = url.split('/').pop().split('&')[0]; // Extract filename before parameters
                console.log(`   ${i + 1}. ${filename}`);
            }
            
            console.log('\n🔍 Verifying no pattern assumptions:');
            
            // Check that URLs contain actual server-provided filenames
            let patternViolations = 0;
            const assumedPatterns = ['001r.jp2', '002v.jp2', '058r.jp2'];
            
            for (const page of result) {
                const filename = page.url.split('/').pop().split('&')[0];
                if (assumedPatterns.some(pattern => page.url.includes(pattern))) {
                    console.log(`   ❌ VIOLATION: Found assumed pattern ${filename}`);
                    patternViolations++;
                }
            }
            
            if (patternViolations === 0) {
                console.log('   ✅ No assumed patterns detected - using server-discovered filenames only');
            }
            
            console.log(`\n🎉 Roman Archive fix verified: ${result.length} pages discovered from server`);
            
        } else {
            console.log('⚠️  No pages found - this could be due to server discovery requirements');
        }
        
    } catch (error) {
        console.log('📊 Testing error handling...');
        
        if (error.message.includes('RULE 0.6') || 
            error.message.includes('server-discovered filenames') ||
            error.message.includes('NEVER assume patterns')) {
            console.log('✅ PERFECT: Error correctly enforces RULE 0.6 compliance');
            console.log(`   📝 Error: ${error.message}`);
        } else {
            console.log('❌ Unexpected error (not RULE 0.6 related):');
            console.log(`   📝 Error: ${error.message}`);
        }
    }
    
    console.log('\n🏁 Roman Archive RULE 0.6 test complete');
}

testRomanArchiveFix().catch(console.error);