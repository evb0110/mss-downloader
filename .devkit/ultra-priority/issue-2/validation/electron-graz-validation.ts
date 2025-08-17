#!/usr/bin/env bun

/**
 * ULTRA-PRIORITY VALIDATION: Issue #2 - Graz Electron Fix
 * 
 * This test validates that the GrazLoader (used in Electron production)
 * now correctly handles the user's problematic URL using webcache fallback.
 * 
 * User's exact problem:
 * - URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472
 * - Previous: 500 Internal Server Error, no pages loaded
 * - Expected: 1246 pages via webcache fallback (6568482 to 6569727)
 */

import { GrazLoader } from '../../../../src/main/services/library-loaders/GrazLoader';
import type { LoaderDependencies } from '../../../../src/main/services/library-loaders/types';

// Mock dependencies for testing
const mockDeps: LoaderDependencies = {
    fetchWithHTTPS: async (url: string, options?: any) => {
        console.log(`[Mock] Fetching: ${url}`);
        
        // Simulate the 500 error for the specific manifest URL
        if (url.includes('https://unipub.uni-graz.at/i3f/v20/6568472/manifest')) {
            console.log('[Mock] Simulating 500 Internal Server Error for manifest');
            return new Response('Internal Server Error', { 
                status: 500, 
                statusText: 'Internal Server Error' 
            });
        }
        
        // For other URLs, return a mock successful response
        return new Response('{}', { status: 200 });
    },
    fetchDirect: async (url: string, options?: any) => {
        return new Response('{}', { status: 200 });
    },
    createProgressMonitor: (title: string, libraryId: string, config?: any, handlers?: any) => {
        return {
            start: () => console.log(`[Progress] Started: ${title}`),
            updateProgress: (current: number, total: number, message: string) => {
                console.log(`[Progress] ${Math.round(current/total*100)}%: ${message}`);
            },
            complete: () => console.log(`[Progress] Completed: ${title}`)
        };
    },
    logger: {
        logManifestLoad: (library: string, url: string, manifest?: any, error?: Error) => {
            console.log(`[Logger] ${library} manifest load: ${error ? 'ERROR' : 'SUCCESS'}`);
            if (error) console.log(`[Logger] Error: ${error.message}`);
        }
    }
};

async function validateGrazFix() {
    console.log('🔥 ULTRA-PRIORITY VALIDATION: Issue #2 Graz Fix');
    console.log('=' .repeat(70));
    
    const USER_PROBLEM_URL = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/6568472';
    
    console.log('\n🎯 Testing user\'s exact problematic URL:');
    console.log(`URL: ${USER_PROBLEM_URL}`);
    console.log('Expected: 1246 pages via webcache fallback (6568482-6569727)');
    console.log('Previous behavior: 500 error, zero pages');
    
    const grazLoader = new GrazLoader(mockDeps);
    
    try {
        console.log('\n🔄 Loading manifest using GrazLoader (Electron production code)...');
        const startTime = Date.now();
        
        const manifest = await grazLoader.loadManifest(USER_PROBLEM_URL);
        
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS! Manifest loaded in ${loadTime}ms`);
        console.log(`📊 Validation Results:`);
        console.log(`  - Total pages: ${manifest.totalPages}`);
        console.log(`  - Library: ${manifest.library}`);
        console.log(`  - Display name: ${manifest.displayName}`);
        console.log(`  - Page links length: ${manifest.pageLinks.length}`);
        
        // Validate the expected page range
        const expectedPageCount = 6569727 - 6568482 + 1; // = 1246
        
        console.log(`\n🔬 Detailed Validation:`);
        console.log(`  - Expected pages: ${expectedPageCount}`);
        console.log(`  - Actual pages: ${manifest.totalPages}`);
        console.log(`  - Match: ${manifest.totalPages === expectedPageCount ? '✅' : '❌'}`);
        
        // Validate webcache URLs
        if (manifest.pageLinks.length > 0) {
            const firstUrl = manifest.pageLinks[0];
            const lastUrl = manifest.pageLinks[manifest.pageLinks.length - 1];
            
            console.log(`  - First page URL: ${firstUrl}`);
            console.log(`  - Last page URL: ${lastUrl}`);
            
            const expectedFirstUrl = 'https://unipub.uni-graz.at/download/webcache/2000/6568482';
            const expectedLastUrl = 'https://unipub.uni-graz.at/download/webcache/2000/6569727';
            
            console.log(`  - First URL correct: ${firstUrl === expectedFirstUrl ? '✅' : '❌'}`);
            console.log(`  - Last URL correct: ${lastUrl === expectedLastUrl ? '✅' : '❌'}`);
        }
        
        // Final validation result
        if (manifest.totalPages === expectedPageCount && 
            manifest.pageLinks.length === expectedPageCount &&
            manifest.pageLinks[0].includes('webcache/2000/6568482') &&
            manifest.pageLinks[manifest.pageLinks.length - 1].includes('webcache/2000/6569727')) {
            
            console.log(`\n🎉 VALIDATION PASSED! Issue #2 is FIXED!`);
            console.log(`✅ The user's exact problem has been resolved.`);
            console.log(`✅ GrazLoader now correctly handles 500 errors with webcache fallback.`);
            
            return true;
        } else {
            console.log(`\n❌ VALIDATION FAILED! Fix needs adjustment.`);
            return false;
        }
        
    } catch (error) {
        console.log(`\n❌ VALIDATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`❌ The fix did not resolve the user's problem.`);
        return false;
    }
}

if (import.meta.main) {
    validateGrazFix()
        .then(success => {
            if (success) {
                console.log('\n🚀 READY FOR AUTONOMOUS VERSION BUMP!');
                process.exit(0);
            } else {
                console.log('\n🛑 Fix validation failed - needs more work.');
                process.exit(1);
            }
        })
        .catch(console.error);
}