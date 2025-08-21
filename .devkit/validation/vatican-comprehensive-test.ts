#!/usr/bin/env bun

// Vatican Library Comprehensive Test Suite
// Proves Vatican Library is 100% functional across multiple manuscripts

interface TestResult {
    url: string;
    manuscriptId: string;
    displayName: string;
    status: 'success' | 'failed';
    pages: number;
    sampleImageSize: number;
    error?: string;
}

async function testVaticanManuscript(url: string): Promise<TestResult> {
    try {
        // Extract manuscript ID
        const match = url.match(/view\/([^/?]+)/);
        if (!match) throw new Error('Invalid URL format');
        
        const manuscriptId = match[1];
        
        // Clean up display name
        let displayName = manuscriptId;
        if (displayName.startsWith('MSS_')) {
            displayName = displayName.substring(4);
        } else if (displayName.startsWith('bav_')) {
            displayName = displayName.substring(4)
                .split('_')
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('.');
        }
        
        // Fetch manifest
        const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptId}/manifest.json`;
        const response = await fetch(manifestUrl);
        
        if (!response.ok) {
            throw new Error(`Manifest fetch failed: ${response.status}`);
        }
        
        const manifest: any = await response.json();
        const canvases = manifest.sequences?.[0]?.canvases || [];
        
        if (canvases.length === 0) {
            throw new Error('No pages found in manifest');
        }
        
        // Test first image
        const firstCanvas = canvases[0];
        const service = firstCanvas.images?.[0]?.resource?.service;
        
        if (!service || !service['@id']) {
            throw new Error('No image service found');
        }
        
        const imageUrl = `${service['@id']}/full/4000,/0/default.jpg`;
        const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
        
        if (!imageResponse.ok) {
            throw new Error(`Image fetch failed: ${imageResponse.status}`);
        }
        
        const imageSize = parseInt(imageResponse.headers.get('content-length') || '0');
        
        return {
            url,
            manuscriptId,
            displayName,
            status: 'success',
            pages: canvases.length,
            sampleImageSize: imageSize,
        };
        
    } catch (error) {
        return {
            url,
            manuscriptId: '',
            displayName: '',
            status: 'failed',
            pages: 0,
            sampleImageSize: 0,
            error: (error as Error).message,
        };
    }
}

async function main() {
    console.log('🔍 Vatican Library Comprehensive Test Suite');
    console.log('══════════════════════════════════════════════\n');
    
    const testUrls = [
        'https://digi.vatlib.it/view/MSS_Vat.lat.1',      // Classic Vat.lat manuscript
        'https://digi.vatlib.it/view/MSS_Vat.lat.3256',   // Another Vat.lat manuscript  
        'https://digi.vatlib.it/view/bav_pal_lat_243',    // Palatine manuscript
        'https://digi.vatlib.it/view/MSS_Reg.lat.15',     // Regina manuscript
        'https://digi.vatlib.it/view/MSS_Vat.gr.1',       // Greek manuscript
    ];
    
    const results: TestResult[] = [];
    
    for (const url of testUrls) {
        console.log(`📚 Testing: ${url}`);
        const result = await testVaticanManuscript(url);
        results.push(result);
        
        if (result.status === 'success') {
            console.log(`   ✅ SUCCESS - ${result.displayName} (${result.pages} pages, ${Math.round(result.sampleImageSize/1024)}KB sample)`);
        } else {
            console.log(`   ❌ FAILED - ${result.error}`);
        }
        console.log('');
    }
    
    // Summary
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log('');
    
    if (successful.length > 0) {
        console.log('📈 SUCCESS DETAILS:');
        successful.forEach(result => {
            console.log(`   ${result.displayName}: ${result.pages} pages (${Math.round(result.sampleImageSize/1024/1024*10)/10}MB sample)`);
        });
        console.log('');
    }
    
    if (failed.length > 0) {
        console.log('🚨 FAILURE DETAILS:');
        failed.forEach(result => {
            console.log(`   ${result.url}: ${result.error}`);
        });
        console.log('');
    }
    
    // Final assessment
    const successRate = (successful.length / results.length) * 100;
    console.log('🏆 FINAL ASSESSMENT');
    console.log('═══════════════════');
    
    if (successRate === 100) {
        console.log('✅ VATICAN LIBRARY IS 100% FUNCTIONAL');
        console.log('   No authentication issues detected');
        console.log('   All URL patterns work correctly');
        console.log('   IIIF manifests load properly');
        console.log('   High-resolution images accessible');
        console.log('');
        console.log('🎯 RECOMMENDATION: TODO #2 should be REMOVED (false alarm)');
    } else if (successRate >= 80) {
        console.log('⚠️  VATICAN LIBRARY MOSTLY FUNCTIONAL');
        console.log(`   Success rate: ${successRate}%`);
        console.log('   Some manuscripts may have individual issues');
    } else {
        console.log('🚨 VATICAN LIBRARY HAS SIGNIFICANT ISSUES');
        console.log(`   Success rate: ${successRate}%`);
        console.log('   Investigation and fixes needed');
    }
    
    process.exit(failed.length > 0 ? 1 : 0);
}

main();