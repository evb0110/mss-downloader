#!/usr/bin/env bun
/**
 * Test script for Admont Codices library implementation
 * Tests both manuscript page URLs and direct IIIF manifest URLs
 */

import { CodicesLoader } from '../../src/main/services/library-loaders/CodicesLoader';
import type { LoaderDependencies } from '../../src/main/services/library-loaders/types';

// Mock dependencies for testing
const mockDeps: LoaderDependencies = {
    fetchDirect: fetch,
    logger: {
        log: (entry: any) => {
            console.log(`[${entry.level}] ${entry.message}`, entry.details || '');
        }
    },
    manifestCache: {
        get: async () => null,
        set: async () => {},
        clear: async () => {}
    }
};

async function testCodicesImplementation() {
    console.log('🧪 TESTING ADMONT CODICES IMPLEMENTATION\n');
    
    const loader = new CodicesLoader(mockDeps);
    
    // Test URLs from Issue #57
    const testUrls = [
        {
            name: 'Manuscript page URL',
            url: 'https://admont.codices.at/codices/169/90299',
            description: 'Standard manuscript viewer URL'
        },
        {
            name: 'Direct IIIF manifest URL', 
            url: 'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701',
            description: 'Direct IIIF v3 manifest URL'
        }
    ];
    
    for (const test of testUrls) {
        console.log(`\n📄 Testing ${test.name}:`);
        console.log(`URL: ${test.url}`);
        console.log(`Description: ${test.description}\n`);
        
        try {
            const startTime = Date.now();
            const manifest = await loader.loadManifest(test.url);
            const duration = Date.now() - startTime;
            
            console.log(`✅ SUCCESS in ${duration}ms`);
            console.log(`📊 Results:`);
            console.log(`  - Library: ${manifest.library}`);
            console.log(`  - Display Name: ${manifest.displayName}`);
            console.log(`  - Total Pages: ${manifest.totalPages}`);
            console.log(`  - Page Links: ${manifest.pageLinks.length} URLs generated`);
            
            if (manifest.pageLinks.length > 0) {
                console.log(`  - First page URL: ${manifest.pageLinks[0]}`);
                console.log(`  - Last page URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
                
                // Test image resolution parameters
                const firstUrl = manifest.pageLinks[0];
                if (firstUrl.includes('/full/full/')) {
                    console.log(`  ✅ Using full resolution (/full/full/)`);
                } else if (firstUrl.includes('/full/max/')) {
                    console.log(`  ✅ Using max resolution (/full/max/)`);
                } else {
                    console.log(`  ⚠️  Resolution parameter: ${firstUrl.match(/\/full\/[^\/]+\//)?.[0] || 'unknown'}`);
                }
            }
            
            // Test first image URL accessibility
            if (manifest.pageLinks.length > 0) {
                console.log(`\n🔍 Testing image accessibility...`);
                try {
                    const imageResponse = await fetch(manifest.pageLinks[0], { method: 'HEAD' });
                    if (imageResponse.ok) {
                        const contentLength = imageResponse.headers.get('content-length');
                        const fileSizeMB = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'unknown';
                        console.log(`  ✅ First image accessible (${fileSizeMB}MB)`);
                    } else {
                        console.log(`  ❌ First image not accessible: ${imageResponse.status}`);
                    }
                } catch (error) {
                    console.log(`  ❌ Image test failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

// Additional test: URL pattern detection
function testUrlDetection() {
    console.log('\n🔍 TESTING URL PATTERN DETECTION\n');
    
    const testPatterns = [
        'https://admont.codices.at/codices/169/90299',
        'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701',
        'https://codices.at/de/manuscript/4-codices-25-2/folios',
        'https://www.codices.at/some/path',
        'https://notcodices.com/test'
    ];
    
    for (const url of testPatterns) {
        const shouldMatch = url.includes('codices.at');
        console.log(`URL: ${url}`);
        console.log(`Should match: ${shouldMatch ? '✅ YES' : '❌ NO'}`);
        console.log(`Pattern check: ${shouldMatch ? 'PASSED' : 'FAILED'}\n`);
    }
}

// Test IIIF resolution parameters
async function testIIIFResolution() {
    console.log('\n🔧 TESTING IIIF RESOLUTION PARAMETERS\n');
    
    const baseImageUrl = 'https://admont.codices.at/iiif/image/9cec1d06-e05f-48d4-a36a-e220906a51fd';
    const resolutionTests = [
        '/full/full/0/default.jpg',
        '/full/max/0/default.jpg', 
        '/full/2000,/0/default.jpg',
        '/full/4000,/0/default.jpg'
    ];
    
    for (const resolution of resolutionTests) {
        const testUrl = baseImageUrl + resolution;
        console.log(`Testing: ${resolution}`);
        
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            const fileSizeMB = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'unknown';
            
            if (response.ok) {
                console.log(`  ✅ Available (${fileSizeMB}MB)`);
            } else {
                console.log(`  ❌ Not available: ${response.status}`);
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Run all tests
async function runAllTests() {
    await testCodicesImplementation();
    testUrlDetection();
    await testIIIFResolution();
    
    console.log('\n🏁 ADMONT CODICES TESTING COMPLETE');
}

runAllTests().catch(console.error);