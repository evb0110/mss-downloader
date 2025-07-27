const path = require('path');
const { loadSharedDependencies } = require('./src/shared/SharedManifestLoaders');
const { EnhancedManuscriptDownloaderService } = require('./src/main/services/EnhancedManuscriptDownloaderService');

// Test configuration
const TEST_URLS = {
    graz: 'https://unipub.uni-graz.at/obvugrhs/content/pageview/8224540',
    hhu: 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176'
};

async function testGrazTimeout() {
    console.log('\n=== Testing Graz Timeout Error Message ===');
    console.log('This test will simulate a timeout to verify the error message shows correct total time.');
    console.log('URL:', TEST_URLS.graz);
    
    const downloader = new EnhancedManuscriptDownloaderService();
    
    try {
        // Temporarily modify the Graz URL to point to a non-existent server to force timeout
        const badUrl = 'https://unipub.uni-graz.at.invalid/test';
        console.log('Testing with invalid URL to force timeout:', badUrl);
        
        const startTime = Date.now();
        await downloader.loadManuscript(badUrl);
    } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`\nError caught after ${duration} seconds:`);
        console.log('Error message:', error.message);
        
        // Check if the error message contains the correct timing information
        if (error.message.includes('seconds')) {
            console.log('✅ Error message includes time information');
            
            // Extract the seconds from the error message
            const match = error.message.match(/(\d+) seconds/);
            if (match) {
                const reportedSeconds = parseInt(match[1]);
                console.log(`Reported time in error: ${reportedSeconds} seconds`);
                console.log(`Actual elapsed time: ${duration} seconds`);
                
                if (Math.abs(reportedSeconds - duration) <= 2) {
                    console.log('✅ Reported time matches actual elapsed time');
                } else {
                    console.log('❌ Time mismatch - error message may still be using attempt time instead of total time');
                }
            }
        }
    }
}

async function testHhuErrorHandling() {
    console.log('\n\n=== Testing HHU Error Handling and Logging ===');
    console.log('URL:', TEST_URLS.hhu);
    
    const dependencies = await loadSharedDependencies();
    const downloader = new EnhancedManuscriptDownloaderService();
    
    try {
        console.log('\nTest 1: Valid HHU URL');
        const startTime = Date.now();
        const manifest = await downloader.loadManuscript(TEST_URLS.hhu);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Manifest loaded successfully in ${duration}ms`);
        console.log(`Display name: ${manifest.displayName}`);
        console.log(`Total pages: ${manifest.totalPages}`);
        console.log(`First page URL: ${manifest.pageLinks[0]}`);
        
    } catch (error) {
        console.log('❌ Failed to load valid HHU URL:', error.message);
    }
    
    // Test invalid URL formats
    console.log('\nTest 2: Invalid HHU URL format');
    try {
        await downloader.loadManuscript('https://digital.ulb.hhu.de/invalid/format');
    } catch (error) {
        console.log('✅ Correctly caught invalid URL format:', error.message);
    }
    
    // Test timeout handling
    console.log('\nTest 3: Non-existent manuscript (should timeout)');
    try {
        const startTime = Date.now();
        await downloader.loadManuscript('https://digital.ulb.hhu.de/i3f/v20/99999999/manifest');
    } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`✅ Correctly handled error after ${duration}s:`, error.message);
        
        // Check if proper error message is shown
        if (error.message.includes('HHU') || error.message.includes('Düsseldorf')) {
            console.log('✅ Error message includes library name');
        }
    }
}

async function runTests() {
    console.log('Starting error handling tests...');
    
    try {
        await testGrazTimeout();
        await testHhuErrorHandling();
        
        console.log('\n=== All tests completed ===');
    } catch (error) {
        console.error('Test failed with error:', error);
    }
}

// Run the tests
runTests();