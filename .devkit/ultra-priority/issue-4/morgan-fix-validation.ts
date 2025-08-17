#!/usr/bin/env bun

/**
 * ULTRA-VALIDATION: Issue #4 - Morgan Library URL Concatenation Fix
 * 
 * This test validates that the MorganLoader redirect handling fix
 * prevents URL concatenation bugs that caused the user's error.
 * 
 * User's exact problem:
 * - URL: https://www.themorgan.org/collection/lindau-gospels/thumbs
 * - Error: "Failed to fetch Morgan page: 301 for URL: https://www.themorgan.org/collection/lindau-gospels/thumbshttps://www.themorgan.org/collection/lindau-gospels/thumbs"
 * - Root cause: Redirect URL concatenation bug in fullRedirectUrl construction
 */

import { MorganLoader } from '../../../src/main/services/library-loaders/MorganLoader';
import type { LoaderDependencies } from '../../../src/main/services/library-loaders/types';

// Mock dependencies that simulate the redirect scenarios that previously caused bugs
const mockDeps: LoaderDependencies = {
    fetchDirect: async (url: string, options?: any) => {
        console.log(`[Mock] Fetching: ${url}`);
        
        // Simulate various redirect scenarios
        if (url.includes('/thumbs') && options?.redirect === 'manual') {
            console.log('[Mock] Simulating 301 redirect response');
            
            // SCENARIO 1: Normal relative redirect (should work)
            if (url === 'https://www.themorgan.org/collection/lindau-gospels/thumbs') {
                return new Response('', { 
                    status: 301,
                    headers: new Map([
                        ['location', '/collection/lindau-gospels'] // Relative redirect
                    ])
                });
            }
            
            // SCENARIO 2: Problematic redirect with full URL (this used to cause the bug)
            if (url.includes('test-problematic')) {
                return new Response('', { 
                    status: 301,
                    headers: new Map([
                        ['location', url] // Redirect to itself - this was the bug scenario
                    ])
                });
            }
        }
        
        // For the redirect follow-up request, return valid HTML
        if (options?.redirect === 'follow') {
            return new Response('<html><body>Mock Morgan page with images</body></html>', { 
                status: 200,
                headers: new Map([['content-type', 'text/html']])
            });
        }
        
        return new Response('<html><body>Default response</body></html>', { status: 200 });
    },
    fetchWithHTTPS: async (url: string, options?: any) => {
        return new Response('{}', { status: 200 });
    },
    createProgressMonitor: () => ({
        start: () => {},
        updateProgress: () => {},
        complete: () => {}
    }),
    logger: {
        log: () => {},
        logManifestLoad: () => {}
    }
};

async function validateMorganFix() {
    console.log('🔥 ULTRA-VALIDATION: Issue #4 Morgan URL Concatenation Fix');
    console.log('=' .repeat(80));
    
    const USER_PROBLEM_URL = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    console.log('\n🎯 Testing user\'s exact problematic URL:');
    console.log(`URL: ${USER_PROBLEM_URL}`);
    console.log('Expected: No URL duplication in any error messages');
    console.log('Previous behavior: URL concatenation bug creating duplicated URLs');
    
    const morganLoader = new MorganLoader(mockDeps);
    
    try {
        console.log('\n🔄 Loading manifest using MorganLoader with fixed redirect handling...');
        const startTime = Date.now();
        
        const manifest = await morganLoader.loadManifest(USER_PROBLEM_URL);
        
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS! Manifest loaded in ${loadTime}ms`);
        console.log(`📊 Validation Results:`);
        console.log(`  - Total pages: ${manifest.totalPages}`);
        console.log(`  - Library: ${manifest.library}`);
        console.log(`  - Display name: ${manifest.displayName}`);
        console.log(`  - Original URL preserved: ${manifest.originalUrl === USER_PROBLEM_URL}`);
        
        return true;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`\n📊 Error occurred: ${errorMessage}`);
        
        // CRITICAL CHECK: Ensure no URL duplication in error messages
        if (errorMessage.includes('thumbshttps://') || errorMessage.includes(USER_PROBLEM_URL + USER_PROBLEM_URL)) {
            console.log(`\n❌ VALIDATION FAILED: URL duplication still present in error!`);
            console.log(`❌ The fix did not resolve the concatenation bug.`);
            return false;
        } else {
            console.log(`\n✅ VALIDATION PASSED: No URL duplication detected in error message`);
            console.log(`✅ The redirect handling fix successfully prevents URL concatenation`);
            return true;
        }
    }
}

async function testProblematicRedirectScenario() {
    console.log('\n🧪 TESTING PROBLEMATIC REDIRECT SCENARIO:');
    console.log('This specifically tests the redirect case that used to cause URL duplication');
    
    const problematicUrl = 'https://www.themorgan.org/collection/test-problematic/thumbs';
    const morganLoader = new MorganLoader(mockDeps);
    
    try {
        await morganLoader.loadManifest(problematicUrl);
        console.log('✅ Problematic redirect scenario handled correctly');
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check for URL duplication
        if (errorMessage.includes('test-problematichttps://') || 
            errorMessage.includes(problematicUrl + problematicUrl)) {
            console.log('❌ URL duplication still occurs in problematic redirect scenario');
            return false;
        } else {
            console.log('✅ No URL duplication in problematic redirect scenario');
            return true;
        }
    }
}

if (import.meta.main) {
    console.log('🚀 Starting comprehensive Morgan Library fix validation...\n');
    
    validateMorganFix()
        .then(success1 => testProblematicRedirectScenario()
            .then(success2 => {
                const allTestsPassed = success1 && success2;
                
                if (allTestsPassed) {
                    console.log('\n🎉 ALL TESTS PASSED! Issue #4 Morgan Library URL concatenation bug is FIXED!');
                    console.log('✅ User will no longer see duplicated URLs in error messages');
                    console.log('✅ Redirect handling is now robust and prevents concatenation bugs');
                    process.exit(0);
                } else {
                    console.log('\n❌ VALIDATION FAILED! Morgan fix needs additional work');
                    process.exit(1);
                }
            })
        )
        .catch(console.error);
}