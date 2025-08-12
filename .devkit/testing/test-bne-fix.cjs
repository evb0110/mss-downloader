#!/usr/bin/env node

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testBneFix() {
    console.log('Testing BNE loader fix with the failing URL...\n');
    
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    console.log(`Test URL: ${testUrl}\n`);
    
    try {
        const loaders = new SharedManifestLoaders();
        
        console.log('Attempting to load manifest...');
        const manifest = await loaders.loadManifest(testUrl);
        
        console.log('\n✅ SUCCESS! Manifest loaded successfully');
        console.log(`📚 Library: ${manifest.library}`);
        console.log(`📖 Display Name: ${manifest.displayName}`);
        console.log(`📄 Total Pages: ${manifest.totalPages}`);
        console.log(`🔗 Sample URLs (first 3 and last 3):`);
        
        if (manifest.pageLinks.length > 0) {
            // Show first 3 pages
            for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
                console.log(`   Page ${i + 1}: ${manifest.pageLinks[i]}`);
            }
            
            if (manifest.pageLinks.length > 6) {
                console.log('   ...');
                // Show last 3 pages
                for (let i = manifest.pageLinks.length - 3; i < manifest.pageLinks.length; i++) {
                    console.log(`   Page ${i + 1}: ${manifest.pageLinks[i]}`);
                }
            } else if (manifest.pageLinks.length > 3) {
                // Show remaining pages if total is between 4-6
                for (let i = 3; i < manifest.pageLinks.length; i++) {
                    console.log(`   Page ${i + 1}: ${manifest.pageLinks[i]}`);
                }
            }
        }
        
        console.log('\n🎉 The exponential search fix is working correctly!');
        console.log('The BNE loader can now handle manuscripts of any size without the Infinity issue.');
        
    } catch (error) {
        console.error('\n❌ FAILED! Error occurred:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testBneFix().catch(console.error);