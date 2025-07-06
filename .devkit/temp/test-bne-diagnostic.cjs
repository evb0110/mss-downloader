const https = require('https');
const fs = require('fs');

// Test BNE URL: https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
const manuscriptId = '0000007619';

async function testBneUrl() {
    console.log('=== BNE Diagnostic Test ===');
    console.log(`Testing manuscript ID: ${manuscriptId}`);
    
    // Test the original viewer URL
    console.log('\n1. Testing original viewer URL...');
    const viewerUrl = `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`;
    
    try {
        const viewerResponse = await fetch(viewerUrl);
        console.log(`Viewer URL status: ${viewerResponse.status}`);
        console.log(`Viewer URL headers:`, Object.fromEntries(viewerResponse.headers));
        
        if (viewerResponse.ok) {
            const viewerContent = await viewerResponse.text();
            console.log(`Viewer content length: ${viewerContent.length}`);
            
            // Check for any relevant patterns in the viewer page
            const patterns = [
                /pdf\.raw\?query=id:/,
                /image\.raw\?query=id:/,
                /jpeg\.raw\?query=id:/,
                /query=id:(\d+)/g,
                /page=(\d+)/g
            ];
            
            console.log('\nPatterns found in viewer page:');
            patterns.forEach((pattern, index) => {
                const matches = viewerContent.match(pattern);
                if (matches) {
                    console.log(`  Pattern ${index + 1}: ${matches.slice(0, 3).join(', ')}`);
                }
            });
        }
    } catch (error) {
        console.error('Error testing viewer URL:', error.message);
    }
    
    // Test the current implementation's approach
    console.log('\n2. Testing current implementation approach...');
    
    const testUrls = [
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`,
        `https://bdh-rd.bne.es/image.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/jpeg.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\nTesting: ${testUrl}`);
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log(`  Content-Length: ${response.headers.get('content-length')}`);
            
            if (response.ok) {
                console.log('  ✓ URL accessible');
            } else {
                console.log('  ✗ URL not accessible');
            }
        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);
        }
    }
    
    // Test alternative patterns
    console.log('\n3. Testing alternative URL patterns...');
    
    const alternativeUrls = [
        `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/bdhd/BD/${manuscriptId}`,
        `https://bdh-rd.bne.es/bdhd/hd/${manuscriptId}`,
        `https://bdh-rd.bne.es/bdhd/detalle/${manuscriptId}`,
    ];
    
    for (const altUrl of alternativeUrls) {
        console.log(`\nTesting alternative: ${altUrl}`);
        try {
            const response = await fetch(altUrl, { method: 'HEAD' });
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                console.log('  ✓ URL accessible');
            }
        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);
        }
    }
    
    // Test with different manuscript IDs to see if the issue is specific to this manuscript
    console.log('\n4. Testing with different manuscript IDs...');
    
    const testIds = ['0000007619', '0000001234', '0000000001', '0000050000'];
    
    for (const testId of testIds) {
        console.log(`\nTesting manuscript ID: ${testId}`);
        const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${testId}&page=1&jpeg=true`;
        
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                console.log('  ✓ Valid image response');
            } else {
                console.log('  ✗ No valid image response');
            }
        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);
        }
    }
    
    console.log('\n=== BNE Diagnostic Complete ===');
}

testBneUrl().catch(console.error);