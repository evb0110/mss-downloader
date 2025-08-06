#!/usr/bin/env node

/**
 * ULTRA-COMPREHENSIVE GRENOBLE URL CONCATENATION BUG TRACER
 * This script traces the exact execution path to find where URL concatenation occurs
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

console.log('🔬 ULTRA-COMPREHENSIVE GRENOBLE BUG ANALYSIS');
console.log('============================================');
console.log('');

// Test URLs from the original issue
const testUrls = [
    'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
    // Add variations to test different scenarios
    'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f10.item.zoom',
    'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.highres'
];

// Hook into URL processing to trace where concatenation happens
class DebuggingSharedManifestLoaders extends SharedManifestLoaders {
    constructor() {
        super();
        
        // Override the fetch function to trace URL handling
        this.originalFetch = this.fetchWithRetry;
        this.fetchWithRetry = this.tracingFetch.bind(this);
    }
    
    async tracingFetch(url, options = {}, retries = 3) {
        console.log(`🔍 [TRACE] fetchWithRetry called with:`);
        console.log(`   Original URL: ${url}`);
        console.log(`   URL type: ${typeof url}`);
        console.log(`   URL length: ${url ? url.length : 'null'}`);
        
        // Check for the specific malformation pattern
        if (url && url.includes('.frhttps://')) {
            console.log(`❌ [BUG DETECTED] Malformed URL contains .frhttps://`);
            console.log(`   Full malformed URL: ${url}`);
            console.trace('Stack trace to malformed URL:');
        }
        
        // Check for hostname concatenation pattern
        const concatenationPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
        const match = url.match(concatenationPattern);
        if (match && !url.startsWith('http')) {
            console.log(`❌ [BUG DETECTED] Hostname concatenation detected:`);
            console.log(`   Extracted hostname: ${match[1]}`);
            console.log(`   Extracted URL: ${match[2]}`);
            console.trace('Stack trace to concatenation bug:');
        }
        
        return this.originalFetch.call(this, url, options, retries);
    }
    
    sanitizeUrl(url) {
        console.log(`🧹 [SANITIZE] Input URL: ${url}`);
        const result = super.sanitizeUrl(url);
        console.log(`🧹 [SANITIZE] Output URL: ${result}`);
        if (url !== result) {
            console.log(`✅ [SANITIZE] URL was modified by sanitizer`);
        }
        return result;
    }
    
    async defaultNodeFetch(url, options = {}, retries = 3) {
        console.log(`📡 [NODE_FETCH] Called with URL: ${url}`);
        return super.defaultNodeFetch(url, options, retries);
    }
    
    async getGrenobleManifest(url) {
        console.log(`📚 [GRENOBLE] getGrenobleManifest called with: ${url}`);
        
        // Extract document ID and trace the process
        const match = url.match(/ark:\/12148\/([^/]+)/);
        if (!match) {
            console.log(`❌ [GRENOBLE] Invalid URL - no ARK identifier found`);
            throw new Error('Invalid Grenoble URL');
        }
        
        const documentId = match[1];
        console.log(`📚 [GRENOBLE] Extracted document ID: ${documentId}`);
        
        const manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/manifest.json`;
        console.log(`📚 [GRENOBLE] Constructed manifest URL: ${manifestUrl}`);
        
        return super.getGrenobleManifest(url);
    }
}

async function comprehensiveTest() {
    console.log('Starting comprehensive URL concatenation analysis...');
    console.log('');
    
    const debugLoader = new DebuggingSharedManifestLoaders();
    
    for (let i = 0; i < testUrls.length; i++) {
        const testUrl = testUrls[i];
        console.log(`\n🧪 TEST ${i + 1}: ${testUrl}`);
        console.log('─'.repeat(80));
        
        try {
            // First test URL sanitization directly
            console.log(`\n1️⃣ Testing URL sanitization:`);
            const sanitized = debugLoader.sanitizeUrl(testUrl);
            
            // Test malformed URL detection
            console.log(`\n2️⃣ Testing malformed URL detection:`);
            const malformedUrl = `pagella.bm-grenoble.fr${testUrl}`;
            console.log(`   Testing malformed: ${malformedUrl}`);
            const fixedUrl = debugLoader.sanitizeUrl(malformedUrl);
            
            // Now test the full manifest loading
            console.log(`\n3️⃣ Testing full manifest loading:`);
            const manifest = await debugLoader.getGrenobleManifest(testUrl);
            
            console.log(`✅ TEST ${i + 1} PASSED`);
            console.log(`   Pages found: ${manifest.images ? manifest.images.length : 0}`);
            
            if (manifest.images && manifest.images.length > 0) {
                console.log(`   First page: ${manifest.images[0].url.substring(0, 80)}...`);
            }
            
        } catch (error) {
            console.log(`❌ TEST ${i + 1} FAILED: ${error.message}`);
            
            // Analyze the error for URL concatenation patterns
            if (error.message.includes('EAI_AGAIN')) {
                console.log(`🔍 DNS resolution error - checking for malformed hostname`);
                
                // Try to extract hostname from error context
                const stackTrace = error.stack || '';
                if (stackTrace.includes('pagella.bm-grenoble.fr')) {
                    console.log(`   Stack trace contains Grenoble hostname`);
                }
            }
            
            console.log(`   Full error: ${error.message}`);
        }
        
        console.log('─'.repeat(80));
    }
}

// Also test the library detection logic
console.log(`\n🔍 TESTING LIBRARY DETECTION:`);
const testDetectionUrls = [
    'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
    'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom'
];

testDetectionUrls.forEach((url, i) => {
    console.log(`URL ${i + 1}: ${url}`);
    console.log(`  Contains grenoble: ${url.includes('pagella.bm-grenoble.fr')}`);
    console.log(`  Starts with http: ${url.startsWith('http')}`);
    console.log(`  URL length: ${url.length}`);
});

comprehensiveTest()
    .then(() => {
        console.log('\n✅ COMPREHENSIVE ANALYSIS COMPLETE');
        console.log('If no URL concatenation was detected, the bug may be elsewhere in the system');
        process.exit(0);
    })
    .catch(error => {
        console.log('\n❌ COMPREHENSIVE ANALYSIS FAILED');
        console.log('Error:', error.message);
        process.exit(1);
    });