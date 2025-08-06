#!/usr/bin/env node

/**
 * ULTRA-PRIORITY TEST: Reproduce Issue #13 - Grenoble URL concatenation error
 * Using ACTUAL production code (not isolated test)
 */

const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function reproduceGrenobleError() {
    console.log('🔥 ULTRA-PRIORITY ISSUE #13 REPRODUCTION TEST 🔥');
    console.log('=' .repeat(50));
    
    const loaders = new SharedManifestLoaders();
    
    // Exact URL from user
    const userUrl = 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
    
    console.log('Testing with exact user URL:', userUrl);
    
    try {
        // First, test URL sanitization
        const sanitized = loaders.sanitizeUrl(userUrl);
        console.log('Sanitized URL:', sanitized);
        
        // Try to recognize the library
        const library = loaders.recognizeLibrary(userUrl);
        console.log('Recognized library:', library);
        
        // Try to get manifest
        console.log('\nAttempting to fetch manifest...');
        const manifest = await loaders.getManifest(userUrl);
        console.log('✅ SUCCESS: Manifest fetched');
        console.log('Pages found:', manifest.images?.length || 0);
        
        // Test with malformed URL (simulating the error)
        console.log('\n' + '='.repeat(50));
        console.log('Testing with MALFORMED URL (simulating the error)...');
        const malformedUrl = 'pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom';
        console.log('Malformed URL:', malformedUrl);
        
        const sanitizedMalformed = loaders.sanitizeUrl(malformedUrl);
        console.log('Sanitized malformed URL:', sanitizedMalformed);
        
        if (sanitizedMalformed === userUrl) {
            console.log('✅ URL CORRECTLY SANITIZED!');
        } else {
            console.log('❌ SANITIZATION FAILED!');
            console.log('Expected:', userUrl);
            console.log('Got:', sanitizedMalformed);
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Full error:', error);
        
        // Check if it's the DNS error
        if (error.message.includes('EAI_AGAIN')) {
            console.error('\n🔴 CRITICAL: DNS error with malformed hostname detected!');
            console.error('This is the exact error the user is experiencing.');
        }
    }
}

// Run the test
reproduceGrenobleError().catch(console.error);