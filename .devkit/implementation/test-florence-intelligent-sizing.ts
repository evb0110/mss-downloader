#!/usr/bin/env bun

/**
 * Test Script for Florence Intelligent Sizing Implementation
 * 
 * Tests the new intelligent page size determination system with:
 * - Known problematic manuscript 217710 (if it exists) 
 * - Current working test manuscript (317515)
 * - Various error scenarios and fallback behavior
 */

import { FlorenceLoaderWithIntelligentSizing } from './FlorenceLoaderWithIntelligentSizing';

// Mock dependencies for testing
const mockDeps = {
    logger: {
        log: (entry: any) => {
            console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
            if (entry.details) {
                console.log('  Details:', JSON.stringify(entry.details, null, 2));
            }
        },
        logDownloadError: (library: string, url: string, error: Error) => {
            console.error(`[ERROR] ${library} - ${url}: ${error.message}`);
        }
    },
    fetchWithHTTPS: async (url: string, options?: any) => {
        // Real fetch implementation
        const response = await fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers || {},
            signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined
        });
        return response;
    }
};

async function testIntelligentSizing() {
    console.log('🧪 Testing Florence Intelligent Sizing Implementation\n');
    
    const loader = new FlorenceLoaderWithIntelligentSizing(mockDeps);
    
    // Test URLs - including potentially problematic manuscript 217710
    const testCases = [
        {
            name: 'Current Test Manuscript (Working)',
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            expectedBehavior: 'Should determine optimal size through testing'
        },
        {
            name: 'Manuscript 217710 (Potentially Problematic)',
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/',
            expectedBehavior: 'Should handle 403 errors gracefully with size fallbacks'
        },
        {
            name: 'Alternative Test Manuscript', 
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/',
            expectedBehavior: 'Should work with compound object structure'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.name}`);
        console.log(`📍 URL: ${testCase.url}`);
        console.log(`🎯 Expected: ${testCase.expectedBehavior}\n`);
        
        try {
            const startTime = Date.now();
            const manifest = await loader.loadManifest(testCase.url);
            const duration = Date.now() - startTime;
            
            console.log(`✅ SUCCESS (${duration}ms):`);
            console.log(`  📖 Title: ${manifest.displayName}`);
            console.log(`  📄 Pages: ${manifest.totalPages}`);
            console.log(`  🔗 Library: ${manifest.library}`);
            
            // Extract size info from first page URL
            const firstPageUrl = manifest.pageLinks[0];
            const sizeMatch = firstPageUrl.match(/\/full\/(\d+),\/0\/default\.jpg$/);
            if (sizeMatch) {
                const detectedSize = sizeMatch[1];
                console.log(`  🖼️  Detected Size: ${detectedSize}px width`);
                
                // Validate size is one of our expected sizes
                const expectedSizes = ['6000', '4000', '2048', '1024', '800'];
                if (expectedSizes.includes(detectedSize)) {
                    console.log(`  ✅ Size is within expected range`);
                } else {
                    console.log(`  ⚠️  Unexpected size detected: ${detectedSize}px`);
                }
            }
            
            // Test a few page URLs to ensure they're accessible
            console.log(`\n  🔍 Testing first 3 page URLs for accessibility...`);
            const samplesToTest = manifest.pageLinks.slice(0, Math.min(3, manifest.pageLinks.length));
            
            for (let i = 0; i < samplesToTest.length; i++) {
                const pageUrl = samplesToTest[i];
                try {
                    const pageResponse = await fetch(pageUrl, { method: 'HEAD' });
                    const status = pageResponse.ok ? '✅' : '❌';
                    console.log(`    Page ${i + 1}: ${status} HTTP ${pageResponse.status}`);
                } catch (error: any) {
                    console.log(`    Page ${i + 1}: ❌ ${error.message}`);
                }
            }
            
        } catch (error: any) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // Check if this was an expected type of failure
            if (error.message.includes('403') || error.message.includes('Forbidden')) {
                console.log(`  ℹ️  This appears to be a 403 access restriction error`);
                console.log(`  🎯 The intelligent sizing should have prevented this with fallbacks`);
            } else if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log(`  ℹ️  This appears to be a 404 - manuscript might not exist`);
            } else {
                console.log(`  ⚠️  Unexpected error type - needs investigation`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

async function testSizeDetectionAlgorithm() {
    console.log('\n🔬 Testing Size Detection Algorithm Directly\n');
    
    // Test the size detection on a known working manuscript
    const collection = 'plutei';
    const samplePageId = '317515';
    const manuscriptId = 'plutei:317515';
    
    console.log(`Testing size detection for ${manuscriptId} (sample page: ${samplePageId})`);
    console.log(`Collection: ${collection}\n`);
    
    const sizes = [6000, 4000, 2048, 1024, 800];
    
    for (const size of sizes) {
        const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${samplePageId}/full/${size},/0/default.jpg`;
        
        try {
            const startTime = Date.now();
            const response = await fetch(testUrl, { method: 'HEAD' });
            const duration = Date.now() - startTime;
            
            const status = response.ok ? '✅ AVAILABLE' : `❌ ${response.status}`;
            console.log(`  ${size}px: ${status} (${duration}ms)`);
            
            if (response.ok) {
                // Check content-length if available
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                    const sizeKB = Math.round(parseInt(contentLength) / 1024);
                    console.log(`    📏 Estimated size: ${sizeKB}KB`);
                }
                
                // Once we find a working size, we can stop (this mimics the algorithm)
                console.log(`    🎯 Algorithm would choose this size and stop testing`);
                break;
            }
            
        } catch (error: any) {
            console.log(`  ${size}px: ❌ ERROR - ${error.message}`);
        }
    }
}

async function main() {
    try {
        await testIntelligentSizing();
        await testSizeDetectionAlgorithm();
        
        console.log('\n🎉 Testing completed!');
        console.log('\nNext steps:');
        console.log('1. Review the intelligent sizing behavior above');
        console.log('2. Verify that problematic manuscripts now work with smaller sizes');
        console.log('3. Confirm that working manuscripts still get maximum quality when possible');
        console.log('4. If tests look good, integrate into main FlorenceLoader.ts');
        
    } catch (error: any) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run the tests
main().catch(console.error);