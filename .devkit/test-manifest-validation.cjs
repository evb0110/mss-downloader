#!/usr/bin/env node

// Test the fixed Belgica KBR manifest loading

const path = require('path');

async function testManifestLoading() {
    try {
        console.log('Testing Belgica KBR manifest loading with multi-page discovery...');
        
        // Import the service
        const { EnhancedManuscriptDownloaderService } = await import('../dist/main/services/EnhancedManuscriptDownloaderService.js');
        
        const service = new EnhancedManuscriptDownloaderService();
        
        const testUrl = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0007/';
        
        console.log(`Testing with URL: ${testUrl}`);
        console.log('\nLoading manifest...');
        
        const manifest = await service.loadBelgicaKbrManifest(testUrl);
        
        console.log('\n=== BELGICA KBR MANIFEST RESULTS ===');
        console.log(`Display Name: ${manifest.displayName}`);
        console.log(`Library: ${manifest.library}`);
        console.log(`Total Pages: ${manifest.totalPages}`);
        console.log(`Page Links Count: ${manifest.pageLinks.length}`);
        console.log(`Original URL: ${manifest.originalUrl}`);
        
        if (manifest.pageLinks.length > 0) {
            console.log('\nFirst few page URLs:');
            manifest.pageLinks.slice(0, Math.min(5, manifest.pageLinks.length)).forEach((url, index) => {
                console.log(`  Page ${index + 1}: ${url}`);
            });
            
            if (manifest.pageLinks.length > 5) {
                console.log(`  ... and ${manifest.pageLinks.length - 5} more pages`);
            }
        }
        
        // Validation
        if (manifest.totalPages > 1) {
            console.log('\n✅ SUCCESS: Multi-page discovery is working!');
            console.log(`✅ Discovered ${manifest.totalPages} pages for the manuscript`);
            
            // Test page URL format
            const sampleUrl = manifest.pageLinks[0];
            console.log(`\nSample page URL: ${sampleUrl}`);
            
            // Check if URLs follow expected pattern
            const isValidPattern = manifest.pageLinks.every(url => 
                url.includes('viewerd.kbr.be') && 
                url.includes('zoomtiles') && 
                url.includes('BE-KBR00_A-1589485')
            );
            
            if (isValidPattern) {
                console.log('✅ All page URLs follow the expected pattern');
            } else {
                console.log('❌ Some page URLs do not follow the expected pattern');
            }
            
        } else {
            console.log('\n❌ ISSUE: Only single page discovered');
            console.log('This means the multi-page discovery is not working properly');
        }
        
    } catch (error) {
        console.error('\n❌ Error testing manifest loading:', error.message);
        console.error(error.stack);
    }
}

testManifestLoading();