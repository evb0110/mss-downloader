const { app } = require('electron');
const path = require('path');

// Import the enhanced manuscript downloader service
const { EnhancedManuscriptDownloaderService } = require(path.join(__dirname, '../../dist/main/services/EnhancedManuscriptDownloaderService.js'));

async function testGrazFix() {
    console.log('Testing Graz manifest loading fix...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    
    const testCases = [
        {
            name: 'Valid titleinfo URL',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            shouldSucceed: true
        },
        {
            name: 'Valid pageview URL',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540',
            shouldSucceed: true
        },
        {
            name: 'Direct webcache URL (should fail with clear message)',
            url: 'https://unipub.uni-graz.at/download/webcache/2000/8224540',
            shouldSucceed: false,
            expectedError: 'Direct webcache image URLs cannot be used'
        },
        {
            name: 'Invalid URL without ID',
            url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/',
            shouldSucceed: false,
            expectedError: 'Could not extract manuscript ID'
        },
        {
            name: 'Non-Graz URL',
            url: 'https://example.com/manuscript/123',
            shouldSucceed: false,
            expectedError: 'Invalid Graz URL'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n=== Testing: ${testCase.name} ===`);
        console.log(`URL: ${testCase.url}`);
        
        try {
            const manifest = await service.loadGrazManifest(testCase.url);
            
            if (testCase.shouldSucceed) {
                console.log('✅ Success!');
                console.log(`  - Display name: ${manifest.displayName}`);
                console.log(`  - Total pages: ${manifest.totalPages}`);
                console.log(`  - Library: ${manifest.library}`);
                console.log(`  - First page URL: ${manifest.pageLinks[0]}`);
            } else {
                console.log('❌ Expected to fail but succeeded');
            }
        } catch (error) {
            if (!testCase.shouldSucceed) {
                console.log('✅ Failed as expected');
                console.log(`  - Error: ${error.message}`);
                
                if (testCase.expectedError && !error.message.includes(testCase.expectedError)) {
                    console.log(`  - ⚠️  Expected error to contain: "${testCase.expectedError}"`);
                }
            } else {
                console.log('❌ Unexpected failure');
                console.log(`  - Error: ${error.message}`);
                console.log(`  - Stack: ${error.stack}`);
            }
        }
    }
    
    console.log('\n\nTest completed.');
}

// If electron is not available, test direct loading
if (!app) {
    console.log('Running without Electron, testing direct module loading...\n');
    
    // Test that the error messages are improved
    console.log('Expected improvements:');
    console.log('1. Better logging with [Graz] prefix');
    console.log('2. More detailed error messages');
    console.log('3. URL validation before attempting to load');
    console.log('4. Better error codes handling (ETIMEDOUT, ECONNRESET, etc.)');
    console.log('5. Logging to download logger for debugging');
} else {
    app.whenReady().then(() => {
        testGrazFix().then(() => {
            app.quit();
        }).catch(error => {
            console.error('Test failed:', error);
            app.quit();
        });
    });
}