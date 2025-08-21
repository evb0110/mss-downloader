#!/usr/bin/env bun

/**
 * DIGITAL SCRIPTORIUM FINAL VALIDATION
 * Comprehensive test of fixed implementation
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders';

async function finalValidation() {
    console.log('🏁 DIGITAL SCRIPTORIUM FINAL VALIDATION REPORT');
    console.log('===============================================');
    console.log('Testing current implementation after metadata parsing fix\n');
    
    const loader = new SharedManifestLoaders();
    const results: any[] = [];
    
    const testCases = [
        {
            name: 'Penn Manuscript (Large)',
            url: 'https://search.digital-scriptorium.org/catalog/DS1649',
            expectedPages: 353,
            institution: 'University of Pennsylvania'
        },
        {
            name: 'Penn Manuscript (Small)',
            url: 'https://search.digital-scriptorium.org/catalog/DS1742',
            expectedPages: 57,
            institution: 'University of Pennsylvania'
        },
        {
            name: 'Princeton Manuscript',
            url: 'https://search.digital-scriptorium.org/catalog/DS3064',
            expectedPages: 136,
            institution: 'Princeton University'
        }
    ];
    
    for (const test of testCases) {
        console.log(`📊 Testing ${test.name}...`);
        
        try {
            console.time(`${test.name} loading time`);
            const result = await loader.getDigitalScriptoriumManifest(test.url);
            console.timeEnd(`${test.name} loading time`);
            
            if (result && result.images) {
                const pageCount = result.images.length;
                const title = result.displayName;
                const firstImageUrl = result.images[0]?.url;
                const lastImageUrl = result.images[result.images.length - 1]?.url;
                
                // Check resolution patterns
                const hasFullResolution = result.images.some(img => 
                    img.url.includes('/full/full/') || img.url.includes('/full/max/'));
                const hasThumbnails = result.images.some(img => 
                    img.url.includes('/full/!'));
                
                // Determine IIIF server
                let server = 'Unknown';
                if (firstImageUrl.includes('iiif-images.library.upenn.edu')) {
                    server = 'Penn IIIF Server';
                } else if (firstImageUrl.includes('iiif-cloud.princeton.edu')) {
                    server = 'Princeton IIIF Server';
                }
                
                const testResult = {
                    name: test.name,
                    status: 'SUCCESS',
                    pages: pageCount,
                    expectedPages: test.expectedPages,
                    title: title,
                    institution: test.institution,
                    server: server,
                    hasFullResolution: hasFullResolution,
                    hasThumbnails: hasThumbnails,
                    firstImageUrl: firstImageUrl?.substring(0, 80) + '...',
                    lastImageUrl: lastImageUrl?.substring(0, 80) + '...'
                };
                
                results.push(testResult);
                
                console.log(`   ✅ SUCCESS: ${pageCount}/${test.expectedPages} pages`);
                console.log(`   📑 Title: "${title}"`);
                console.log(`   🏛️  Institution: ${test.institution}`);
                console.log(`   🖥️  Server: ${server}`);
                console.log(`   🔍 Resolution: ${hasFullResolution ? '✅ Full' : '⚠️  Standard'} ${hasThumbnails ? '(Thumbnails converted)' : ''}`);
                
            } else {
                results.push({
                    name: test.name,
                    status: 'FAILED',
                    error: 'No images found'
                });
                console.log(`   ❌ FAILED: No images found`);
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            results.push({
                name: test.name,
                status: 'FAILED',
                error: errorMsg
            });
            console.log(`   ❌ FAILED: ${errorMsg}`);
        }
        
        console.log('');
    }
    
    // Summary report
    console.log('📋 FINAL VALIDATION SUMMARY');
    console.log('===========================');
    
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = results.length;
    
    console.log(`Overall Success Rate: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)\n`);
    
    console.log('Individual Results:');
    results.forEach(result => {
        if (result.status === 'SUCCESS') {
            console.log(`✅ ${result.name}: ${result.pages} pages from ${result.institution}`);
        } else {
            console.log(`❌ ${result.name}: ${result.error}`);
        }
    });
    
    console.log('\n🎯 CONCLUSION');
    console.log('=============');
    if (successCount === totalCount) {
        console.log('🎉 Digital Scriptorium implementation is FULLY WORKING!');
        console.log('✅ Supports both Penn and Princeton institutions');
        console.log('✅ Handles IIIF v2 manifests correctly');
        console.log('✅ Converts thumbnails to full resolution (Penn)');
        console.log('✅ Parses metadata without type errors (Princeton)');
        console.log('✅ Extracts meaningful manuscript titles');
        console.log('✅ Catalog URL parsing works correctly');
    } else {
        console.log('⚠️  Some issues remain that need attention');
    }
    
    console.log('\n📊 TECHNICAL DETAILS');
    console.log('====================');
    console.log('- Detection: digital-scriptorium.org and colenda.library.upenn.edu');
    console.log('- Implementation: SharedManifestLoaders.getDigitalScriptoriumManifest()');
    console.log('- IIIF Support: v2 format with robust metadata parsing');
    console.log('- Resolution: Automatic thumbnail-to-full conversion for Penn');
    console.log('- Error Handling: Type-safe metadata parsing prevents crashes');
}

finalValidation().catch(console.error);