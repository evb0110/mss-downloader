#!/usr/bin/env bun

/**
 * Simple British Library investigation
 */

async function simpleBLInvestigation() {
    console.log('🔍 Simple BL investigation...\n');
    
    const testUrl = 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001';
    
    console.log('Test URL:', testUrl);
    console.log('ARK ID: ark:/81055/vdc_100055984026.0x000001');
    
    // Based on common IIIF patterns for British Library, let's try variations
    const urlEncoded = encodeURIComponent('ark:/81055/vdc_100055984026.0x000001');
    console.log('URL encoded ARK:', urlEncoded);
    
    // The bl.digirati.io likely uses a different pattern
    // Common patterns:
    console.log('\nCommon IIIF manifest URL patterns to try:');
    console.log('1. https://bl.digirati.io/iiif/ark%3A%2F81055%2Fvdc_100055984026.0x000001/manifest.json');
    console.log('2. https://api.bl.uk/metadata/iiif/ark%3A%2F81055%2Fvdc_100055984026.0x000001/manifest.json');
    console.log('3. Direct API approach without ark encoding');
    
    try {
        // Test the URL encoded version
        const encodedUrl = `https://bl.digirati.io/iiif/${urlEncoded}/manifest.json`;
        console.log('\n🧪 Testing URL-encoded version:', encodedUrl);
        
        const response = await fetch(encodedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const text = await response.text();
            console.log('✅ SUCCESS! Manifest found');
            console.log('Content length:', text.length);
            
            try {
                const manifest = JSON.parse(text);
                console.log('✅ Valid JSON');
                if (manifest.sequences) {
                    console.log(`📄 Found ${manifest.sequences[0]?.canvases?.length} pages`);
                }
            } catch (e) {
                console.log('❌ Invalid JSON');
            }
        } else {
            console.log('❌ Failed with status:', response.status);
        }
        
    } catch (error) {
        console.log('❌ Error:', error);
    }
}

simpleBLInvestigation().catch(console.error);