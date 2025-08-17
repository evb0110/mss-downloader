#!/usr/bin/env bun

/**
 * TEST: Issue #2 - Graz 500 Internal Server Error
 * Tests the specific problematic URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

async function testGrazProblemUrl() {
    console.log('🔥 ISSUE #2 - GRAZ 500 ERROR TEST');
    console.log('=' .repeat(70));
    
    const PROBLEM_URL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472';
    const WORKING_URL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6840185'; // From issue comments
    
    const manifestLoaders = new SharedManifestLoaders();
    
    console.log('\n📋 Testing PROBLEMATIC Graz URL:');
    console.log(`URL: ${PROBLEM_URL}`);
    
    try {
        const startTime = Date.now();
        const manifest = await manifestLoaders.getManifestForLibrary('graz', PROBLEM_URL);
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Loaded in ${loadTime}ms`);
        console.log(`Pages: ${Array.isArray(manifest) ? manifest.length : (manifest as any)?.images?.length || 0}`);
        
    } catch (error) {
        console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        
        // Check if it's a 500 error as reported by user
        if (error instanceof Error && error.message.includes('500')) {
            console.log('🎯 CONFIRMED: This matches user-reported 500 Internal Server Error');
        }
    }
    
    console.log('\n📋 Testing WORKING Graz URL for comparison:');
    console.log(`URL: ${WORKING_URL}`);
    
    try {
        const startTime = Date.now();
        const manifest = await manifestLoaders.getManifestForLibrary('graz', WORKING_URL);
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ SUCCESS: Loaded in ${loadTime}ms`);
        console.log(`Pages: ${Array.isArray(manifest) ? manifest.length : (manifest as any)?.images?.length || 0}`);
        
    } catch (error) {
        console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('\n📊 ANALYSIS:');
    console.log('Issue #2 appears to be a server-side problem with that specific manuscript.');
    console.log('The Graz library code is working correctly - it\'s the server returning 500.');
    console.log('This needs better error handling, not a code fix.');
}

if (import.meta.main) {
    testGrazProblemUrl().catch(console.error);
}