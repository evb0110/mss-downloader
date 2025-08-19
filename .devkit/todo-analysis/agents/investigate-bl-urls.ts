#!/usr/bin/env bun

/**
 * Investigate British Library URL patterns
 */

import { SharedManifestLoaders } from '../../../src/shared/SharedManifestLoaders.js';

async function investigateUrlPatterns() {
    console.log('🔍 Investigating British Library URL patterns...\n');
    
    const testUrl = 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001';
    const arkId = 'ark:/81055/vdc_100055984026.0x000001';
    
    // Test different manifest URL patterns
    const patterns = [
        `https://bl.digirati.io/iiif/${arkId}/manifest.json`,
        `https://bl.digirati.io/iiif/manifest/${arkId}`,
        `https://api.bl.uk/metadata/iiif/${arkId}/manifest.json`,
        `https://access.bl.uk/iiif/${arkId}/manifest.json`,
        `https://iiif.bl.uk/${arkId}/manifest.json`
    ];
    
    const loader = new SharedManifestLoaders();
    
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        console.log(`\n🧪 Testing pattern ${i + 1}:`, pattern);
        
        try {
            const response = await loader.fetchWithRetry(pattern);
            console.log(`✅ Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                console.log('🎉 SUCCESS! Found working manifest URL');
                const text = await response.text();
                console.log('Response length:', text.length);
                
                // Try to parse as JSON to verify it's a valid manifest
                try {
                    const manifest = JSON.parse(text);
                    console.log('✅ Valid JSON manifest');
                    if (manifest.sequences || manifest.items) {
                        console.log('✅ Contains IIIF sequences/items');
                        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                            console.log(`📄 Found ${manifest.sequences[0].canvases.length} canvases`);
                        }
                        if (manifest.items && Array.isArray(manifest.items)) {
                            console.log(`📄 Found ${manifest.items.length} items`);
                        }
                    }
                    console.log('🏆 THIS IS THE CORRECT PATTERN!');
                    break;
                } catch (e) {
                    console.log('❌ Response is not valid JSON');
                }
            }
        } catch (error) {
            console.log(`❌ Error: ${error}`);
        }
    }
    
    // Also try to inspect the original viewer page to find the correct manifest URL
    console.log('\n🔍 Inspecting original viewer page...');
    try {
        const response = await loader.fetchWithRetry(testUrl);
        if (response.ok) {
            const html = await response.text();
            console.log('Page fetched successfully, length:', html.length);
            
            // Look for manifest URLs in the HTML
            const manifestMatches = html.match(/["']([^"']*manifest[^"']*\.json)["']/gi);
            if (manifestMatches) {
                console.log('\n🎯 Found potential manifest URLs in HTML:');
                manifestMatches.forEach((match, i) => {
                    const url = match.replace(/["']/g, '');
                    console.log(`${i + 1}. ${url}`);
                });
            } else {
                console.log('❌ No manifest URLs found in HTML');
                
                // Look for any IIIF-related URLs
                const iiifMatches = html.match(/["']([^"']*iiif[^"']*\/)["']/gi);
                if (iiifMatches) {
                    console.log('\n🔍 Found IIIF service URLs:');
                    iiifMatches.slice(0, 10).forEach((match, i) => {
                        const url = match.replace(/["']/g, '');
                        console.log(`${i + 1}. ${url}`);
                    });
                }
            }
        }
    } catch (error) {
        console.log(`❌ Error fetching viewer page: ${error}`);
    }
}

investigateUrlPatterns().catch(console.error);