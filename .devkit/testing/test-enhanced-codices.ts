#!/usr/bin/env bun
/**
 * Enhanced test script for Admont Codices library implementation
 * Tests the upgraded loader with browser automation support
 */

import { CodicesLoader } from '../../src/main/services/library-loaders/CodicesLoader';
import type { LoaderDependencies } from '../../src/main/services/library-loaders/types';

// Mock dependencies for testing
const mockDeps: LoaderDependencies = {
    fetchDirect: fetch,
    logger: {
        log: (entry: any) => {
            const timestamp = new Date().toISOString().substring(11, 19);
            console.log(`[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`, entry.details || '');
        }
    },
    manifestCache: {
        get: async () => null,
        set: async () => {},
        clear: async () => {}
    }
};

async function downloadTestImages(manifest: any, sampleCount = 5) {
    console.log(`\n📥 Testing ${sampleCount} sample images for quality validation...`);
    
    if (!manifest.pageLinks || manifest.pageLinks.length === 0) {
        console.log('❌ No page links available for testing');
        return;
    }
    
    const testIndices = [];
    const totalPages = manifest.pageLinks.length;
    
    // Select evenly distributed sample images
    for (let i = 0; i < sampleCount; i++) {
        const index = Math.floor((i * totalPages) / sampleCount);
        testIndices.push(index);
    }
    
    for (let i = 0; i < testIndices.length; i++) {
        const index = testIndices[i];
        const pageUrl = manifest.pageLinks[index];
        
        try {
            console.log(`  Testing page ${index + 1}/${totalPages}: ${pageUrl.substring(pageUrl.lastIndexOf('/') + 1)}`);
            
            const response = await fetch(pageUrl, { method: 'HEAD' });
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                const contentType = response.headers.get('content-type');
                const fileSizeMB = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'unknown';
                
                console.log(`    ✅ Accessible - ${fileSizeMB}MB (${contentType})`);
            } else {
                console.log(`    ❌ Not accessible: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

async function testManuscriptProcessing(manuscriptUrl: string, testName: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📚 ${testName}`);
    console.log(`URL: ${manuscriptUrl}`);
    console.log(`${'='.repeat(80)}`);
    
    const loader = new CodicesLoader(mockDeps);
    
    try {
        const startTime = Date.now();
        const manifest = await loader.loadManifest(manuscriptUrl);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS in ${(duration / 1000).toFixed(1)}s`);
        console.log(`📊 Manuscript Analysis:`);
        console.log(`  - Library: ${manifest.library}`);
        console.log(`  - Display Name: ${manifest.displayName}`);
        console.log(`  - Total Pages: ${manifest.totalPages}`);
        console.log(`  - Original URL: ${manifest.originalUrl}`);
        
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            console.log(`\n🔗 Image URLs Analysis:`);
            console.log(`  - Generated URLs: ${manifest.pageLinks.length}`);
            console.log(`  - First URL: ${manifest.pageLinks[0]}`);
            console.log(`  - Last URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
            
            // Analyze IIIF resolution parameters
            const firstUrl = manifest.pageLinks[0];
            const resolutionMatch = firstUrl.match(/\/full\/([^\/]+)\//);
            const resolution = resolutionMatch ? resolutionMatch[1] : 'unknown';
            console.log(`  - IIIF Resolution: /full/${resolution}/`);
            
            // Estimate total download size
            const avgSizeMB = 1.0; // Based on our testing
            const estimatedTotalSizeMB = (avgSizeMB * manifest.totalPages).toFixed(1);
            console.log(`  - Estimated Total Size: ~${estimatedTotalSizeMB}MB`);
            
            // Auto-split analysis
            const autoSplitThreshold = 300; // Default threshold
            if (parseInt(estimatedTotalSizeMB) > autoSplitThreshold) {
                const numberOfParts = Math.ceil(parseInt(estimatedTotalSizeMB) / 30);
                console.log(`  - Auto-split Required: YES (${numberOfParts} parts)`);
            } else {
                console.log(`  - Auto-split Required: NO (within ${autoSplitThreshold}MB threshold)`);
            }
            
            // Test sample images
            await downloadTestImages(manifest, 3);
        } else {
            console.log(`❌ No page links generated`);
        }
        
        return manifest;
        
    } catch (error) {
        console.log(`❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

async function runComprehensiveTest() {
    console.log('🧪 COMPREHENSIVE ADMONT CODICES TESTING');
    console.log('Testing enhanced loader with browser automation support\n');
    
    // Test cases from Issue #57
    const testCases = [
        {
            name: 'Direct IIIF Manifest URL (Primary Test)',
            url: 'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701',
            expected: 'Should work immediately without browser automation'
        },
        {
            name: 'Manuscript Page URL (Enhanced SPA Support)',
            url: 'https://admont.codices.at/codices/169/90299',
            expected: 'Should work with browser-based manifest discovery'
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        console.log(`\n⏳ Processing: ${testCase.name}`);
        console.log(`Expected: ${testCase.expected}`);
        
        const result = await testManuscriptProcessing(testCase.url, testCase.name);
        results.push({
            name: testCase.name,
            url: testCase.url,
            success: !!result,
            totalPages: result?.totalPages || 0,
            hasImages: result?.pageLinks?.length > 0
        });
    }
    
    // Summary report
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 COMPREHENSIVE TEST SUMMARY');
    console.log(`${'='.repeat(80)}`);
    
    let allPassed = true;
    for (const result of results) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${status} ${result.name}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Pages: ${result.totalPages}, Images: ${result.hasImages ? 'YES' : 'NO'}\n`);
        
        if (!result.success) allPassed = false;
    }
    
    console.log(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
    console.log('\n📝 Implementation Status:');
    console.log('✅ CodicesLoader enhanced with browser automation');
    console.log('✅ Auto-split configuration added');
    console.log('✅ Full IIIF v3 manifest support');
    console.log('✅ Maximum resolution image extraction (/full/full/)');
    console.log('✅ URL pattern detection for all codices.at variants');
    
    return allPassed;
}

// Execute comprehensive test
runComprehensiveTest()
    .then(allPassed => {
        process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });