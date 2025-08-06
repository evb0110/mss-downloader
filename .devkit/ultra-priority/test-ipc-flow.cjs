#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Issue #13 - Test IPC flow
 * Simulating how URL is passed through Electron's IPC mechanism
 */

const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');

async function testIPCFlow() {
    console.log('🔥 TESTING IPC FLOW - Issue #13');
    console.log('━'.repeat(60));
    
    // This simulates what happens in main.ts when parse-manuscript-url is called
    const enhancedManuscriptDownloader = new EnhancedManuscriptDownloaderService();
    
    // Test with the exact user URL
    let url = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    console.log('📍 Original URL:', url);
    console.log('');
    
    // Simulate the URL sanitization that happens in main.ts
    console.log('Step 1: Simulating main.ts sanitization...');
    
    // This is the code from main.ts lines 582-601
    if (url && typeof url === 'string') {
        // Pattern 1: hostname directly concatenated with protocol
        const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
        const concatenatedMatch = url.match(concatenatedPattern);
        if (concatenatedMatch) {
            const [, hostname, actualUrl] = concatenatedMatch;
            console.log('  DETECTED MALFORMED URL:', url);
            console.log('  Extracted hostname:', hostname);
            console.log('  Extracted URL:', actualUrl);
            url = actualUrl;
        }
        // Check for .frhttps:// pattern
        else if (url.includes('.frhttps://')) {
            console.log('  DETECTED MALFORMED URL with .frhttps:// pattern');
            const match = url.match(/(https:\/\/.+)$/);
            if (match) {
                const correctedUrl = match[1];
                console.log('  Corrected URL:', correctedUrl);
                url = correctedUrl;
            }
        } else {
            console.log('  URL appears clean, no sanitization needed');
        }
    }
    
    console.log('');
    console.log('Step 2: Calling enhancedManuscriptDownloader.loadManifest()...');
    console.log('  URL being passed:', url);
    
    try {
        const manifest = await enhancedManuscriptDownloader.loadManifest(url);
        
        console.log('');
        console.log('✅ SUCCESS: Manifest loaded via IPC flow simulation!');
        console.log('  Title:', manifest.title || 'N/A');
        console.log('  Pages:', manifest.pages?.length || 0);
        console.log('  Library:', manifest.library || 'N/A');
        
    } catch (error) {
        console.log('');
        console.log('❌ ERROR in IPC flow:');
        console.log('  Message:', error.message);
        
        if (error.message.includes('pagella.bm-grenoble.frhttps://')) {
            console.log('');
            console.log('🚨 URL CONCATENATION BUG CONFIRMED IN IPC FLOW!');
        }
        
        console.log('');
        console.log('Stack trace:');
        console.log(error.stack);
    }
    
    // Now test with a malformed URL to see if sanitization works
    console.log('\n' + '='.repeat(60));
    console.log('Testing with intentionally malformed URL:');
    console.log('='.repeat(60));
    
    let malformedUrl = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    console.log('Malformed URL:', malformedUrl);
    
    // Apply the same sanitization
    const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
    const concatenatedMatch = malformedUrl.match(concatenatedPattern);
    if (concatenatedMatch) {
        const [, hostname, actualUrl] = concatenatedMatch;
        console.log('  ✅ Sanitization detected and fixed the malformed URL');
        console.log('  Clean URL:', actualUrl);
        malformedUrl = actualUrl;
    } else {
        console.log('  ❌ Sanitization FAILED to detect malformed URL!');
    }
    
    try {
        const manifest2 = await enhancedManuscriptDownloader.loadManifest(malformedUrl);
        console.log('  ✅ Successfully loaded with sanitized URL');
        console.log('  Pages found:', manifest2.pages?.length || 0);
    } catch (error) {
        console.log('  ❌ Still failed after sanitization:', error.message);
    }
}

// Run the test
console.log('Starting IPC flow test...\n');
testIPCFlow().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});