#!/usr/bin/env node

/**
 * Test script to verify HHU Düsseldorf issue fix
 * Testing the specific URL from issue #1
 */

const path = require('path');
const fs = require('fs');

// Import the downloader service
const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');

async function testHHUFix() {
    console.log('Testing HHU Düsseldorf fix for issue #1');
    console.log('=====================================\n');
    
    const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176';
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        const downloader = new EnhancedManuscriptDownloaderService();
        
        // Test manifest loading
        console.log('\nLoading manifest...');
        const manifest = await downloader.loadHhuManifest(testUrl);
        
        console.log('\n✅ SUCCESS! Manifest loaded without errors');
        console.log('\nManifest details:');
        console.log(`- Display name: ${manifest.displayName}`);
        console.log(`- Total pages: ${manifest.totalPages}`);
        console.log(`- Library: ${manifest.library}`);
        console.log(`- First page URL: ${manifest.pageLinks[0]}`);
        
        // Quick validation
        if (manifest.totalPages > 0 && manifest.pageLinks.length > 0) {
            console.log('\n✅ Manifest validation passed!');
            console.log('The "Unexpected token \'o\'" error has been fixed.');
        } else {
            console.log('\n❌ Manifest validation failed - no pages found');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error:', error);
        
        if (error.message.includes('Unexpected token')) {
            console.error('\n⚠️  The JSON parsing error is still present!');
        }
        
        process.exit(1);
    }
}

// Run the test
testHHUFix().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});