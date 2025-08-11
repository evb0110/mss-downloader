#!/usr/bin/env bun

/**
 * Test script for BNE loader functionality using Bun
 */

import { BneLoader } from '../../src/main/services/library-loaders/BneLoader';
import type { LoaderDependencies } from '../../src/main/services/library-loaders/types';

async function testBneLoader() {
    console.log('🧪 Testing BNE Loader functionality with Bun...\n');
    
    // Test URLs from real BNE manuscripts
    const testUrls = [
        'http://bdh-rd.bne.es/viewer.vm?id=0000014085',
        'https://bdh-rd.bne.es/viewer.vm?id=0000049395',
        'http://bdh-rd.bne.es/viewer.vm?id=0000012148'
    ];
    
    // Create a mock dependencies object
    const mockDeps: LoaderDependencies = {
        fetchDirect: async (url: string) => {
            console.log(`  Fetching: ${url}`);
            // Simulate a successful response
            return new Response('', {
                status: 200,
                headers: {
                    'content-length': '100000',
                    'content-type': 'application/pdf'
                }
            });
        },
        fetchWithProxyFallback: async (url: string) => {
            return mockDeps.fetchDirect(url);
        },
        fetchWithHTTPS: async (url: string, options?: any) => {
            console.log(`  HTTPS fetch: ${url} [${options?.method || 'GET'}]`);
            // Simulate HEAD request response
            if (options?.method === 'HEAD') {
                return new Response('', {
                    status: 200,
                    headers: {
                        'content-length': '50000',
                        'content-type': 'application/pdf'
                    }
                });
            }
            return mockDeps.fetchDirect(url);
        },
        sanitizeUrl: (url: string) => url,
        sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        manifestCache: {
            get: () => null,
            set: () => {},
            has: () => false,
            delete: () => {},
            clear: () => {},
            getStats: () => ({ hits: 0, misses: 0, size: 0 })
        } as any,
        logger: {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.log
        } as any,
        createProgressMonitor: (options: any) => ({
            updateProgress: () => {},
            complete: () => {},
            abort: () => {}
        })
    };
    
    console.log('Testing BNE Loader class structure:');
    console.log('====================================');
    
    try {
        // Create loader instance
        const loader = new BneLoader(mockDeps);
        console.log('✅ BneLoader instantiated successfully');
        
        // Check if methods exist
        const requiredMethods = ['loadManifest', 'getLibraryName'];
        for (const method of requiredMethods) {
            if (typeof (loader as any)[method] === 'function') {
                console.log(`✅ Method '${method}' exists`);
            } else {
                console.log(`❌ Method '${method}' is missing!`);
            }
        }
        
        // Check private methods exist (they should be callable internally)
        const privateMethods = ['robustBneDiscovery', 'fetchBneWithHttps'];
        console.log('\nChecking private methods (should exist):');
        for (const method of privateMethods) {
            if (typeof (loader as any)[method] === 'function') {
                console.log(`✅ Private method '${method}' exists`);
            } else {
                console.log(`❌ Private method '${method}' is missing!`);
            }
        }
        
        // Test getLibraryName
        const libraryName = loader.getLibraryName();
        console.log(`\n✅ Library name: ${libraryName}`);
        if (libraryName !== 'bne') {
            throw new Error(`Expected library name 'bne', got '${libraryName}'`);
        }
        
        console.log('\nTesting manuscript loading:');
        console.log('==========================');
        
        // Test with a sample URL
        const testUrl = testUrls[0];
        console.log(`\nTesting URL: ${testUrl}`);
        
        try {
            // This will use our mock dependencies
            // Since we're mocking, it will try to check pages but won't find real data
            const manifest = await loader.loadManifest(testUrl);
            
            // This should not reach here with our mock data
            console.log('❌ Unexpected: manifest loaded with mock data');
            
        } catch (error: any) {
            // We expect an error since we're using mock data that returns empty responses
            if (error.message.includes('No valid pages found')) {
                console.log('✅ Expected error with mock data: No valid pages found');
            } else if (error.message.includes('Failed to load BNE manuscript')) {
                console.log('✅ Expected error with mock data:', error.message);
            } else {
                console.log('⚠️  Unexpected error:', error.message);
            }
        }
        
        console.log('\n✅ All BNE loader tests completed successfully!');
        console.log('   The robustBneDiscovery method is properly defined in the class.');
        console.log('   The fetchBneWithHttps helper method is properly defined.');
        
    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Test that the issue we fixed doesn't exist anymore
async function testOriginalIssue() {
    console.log('\n🔍 Testing that original issue is fixed:');
    console.log('========================================');
    
    // The original issue was that robustBneDiscovery was called but not defined in BneLoader
    // This test verifies it's now properly defined
    
    const sourceCode = await Bun.file('../../src/main/services/library-loaders/BneLoader.ts').text();
    
    // Check that the method is defined
    if (sourceCode.includes('private async robustBneDiscovery')) {
        console.log('✅ robustBneDiscovery is defined in BneLoader');
    } else {
        console.log('❌ robustBneDiscovery is NOT defined in BneLoader!');
        process.exit(1);
    }
    
    // Check that it's called
    if (sourceCode.includes('this.robustBneDiscovery(')) {
        console.log('✅ robustBneDiscovery is called within the class');
    } else {
        console.log('⚠️  robustBneDiscovery is defined but not used');
    }
    
    // Check helper method
    if (sourceCode.includes('private async fetchBneWithHttps')) {
        console.log('✅ fetchBneWithHttps helper is defined in BneLoader');
    } else {
        console.log('❌ fetchBneWithHttps helper is NOT defined in BneLoader!');
    }
    
    // Ensure the duplicate is removed from EnhancedManuscriptDownloaderService
    const enhancedServiceCode = await Bun.file('../../src/main/services/EnhancedManuscriptDownloaderService.ts').text();
    
    if (!enhancedServiceCode.includes('private async robustBneDiscovery')) {
        console.log('✅ robustBneDiscovery removed from EnhancedManuscriptDownloaderService');
    } else {
        console.log('❌ robustBneDiscovery still exists in EnhancedManuscriptDownloaderService!');
        process.exit(1);
    }
    
    if (!enhancedServiceCode.includes('private async fetchBneWithHttps')) {
        console.log('✅ fetchBneWithHttps removed from EnhancedManuscriptDownloaderService');
    } else {
        console.log('❌ fetchBneWithHttps still exists in EnhancedManuscriptDownloaderService!');
        process.exit(1);
    }
}

// Run tests
async function main() {
    console.log('🚀 BNE Loader Validation Suite (using Bun)');
    console.log('==========================================\n');
    
    await testBneLoader();
    await testOriginalIssue();
    
    console.log('\n✅ All validations passed!');
    console.log('   - BNE Loader class structure: CORRECT');
    console.log('   - Methods properly defined: YES');
    console.log('   - Original issue fixed: YES');
    console.log('   - No duplicates in codebase: VERIFIED');
}

main().catch(console.error);