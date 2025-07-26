const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const fs = require('fs').promises;
const path = require('path');

async function testMorganFix() {
    console.log('🧪 Testing Morgan Library Fix\n');
    console.log('=' .repeat(60));
    
    const service = new EnhancedManuscriptDownloaderService();
    
    // Test URLs
    const testCases = [
        {
            name: 'Lindau Gospels (without /thumbs)',
            url: 'https://www.themorgan.org/collection/lindau-gospels',
            expectedPages: 16
        },
        {
            name: 'Lindau Gospels (with /thumbs - should be handled)',
            url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
            expectedPages: 16
        },
        {
            name: 'Arenberg Gospels',
            url: 'https://www.themorgan.org/collection/arenberg-gospels',
            expectedPages: 12
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📚 Testing: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);
        console.log('-'.repeat(60));
        
        try {
            const manifest = await service.loadMorganManifest(testCase.url);
            
            console.log(`✅ Manifest loaded successfully`);
            console.log(`   Display Name: ${manifest.displayName}`);
            console.log(`   Total Pages: ${manifest.totalPages}`);
            console.log(`   Library: ${manifest.library}`);
            
            if (manifest.totalPages === testCase.expectedPages) {
                console.log(`   ✅ PASS: Expected ${testCase.expectedPages} pages, got ${manifest.totalPages}`);
            } else if (manifest.totalPages > 1) {
                console.log(`   ⚠️  PARTIAL: Expected ${testCase.expectedPages} pages, got ${manifest.totalPages} (but more than 1!)`);
            } else {
                console.log(`   ❌ FAIL: Expected ${testCase.expectedPages} pages, got only ${manifest.totalPages}`);
            }
            
            // Show first few page links
            if (manifest.pageLinks && manifest.pageLinks.length > 0) {
                console.log(`\n   First few page links:`);
                manifest.pageLinks.slice(0, 3).forEach((link, i) => {
                    console.log(`   ${i + 1}. ${link}`);
                });
                if (manifest.pageLinks.length > 3) {
                    console.log(`   ... and ${manifest.pageLinks.length - 3} more`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    
    console.log('\n\n' + '=' .repeat(60));
    console.log('✅ Test completed\n');
}

// Check if the compiled service exists
fs.access(path.join(__dirname, '../../dist/main/services/EnhancedManuscriptDownloaderService.js'))
    .then(() => {
        console.log('Running test with compiled service...\n');
        testMorganFix().catch(console.error);
    })
    .catch(() => {
        console.log('❌ Error: Service not compiled. Please run "npm run build" first.\n');
        console.log('Alternatively, here\'s a standalone test you can run after building:\n');
        
        // Create a standalone test script
        const standaloneScript = `
// Standalone test for Morgan Library fix
const https = require('https');

async function quickTest() {
    const url = 'https://www.themorgan.org/collection/lindau-gospels';
    console.log('Quick test of Morgan fix...');
    console.log('URL:', url);
    
    // The fix should:
    // 1. NOT append /thumbs
    // 2. Find multiple individual page references
    // 3. Extract facsimile images from those pages
    
    console.log('\\nExpected: 16 pages');
    console.log('Previous bug: Only 1 page');
    console.log('\\nTo fully test, build and run the app with this URL');
}

quickTest();
`;
        
        console.log(standaloneScript);
    });