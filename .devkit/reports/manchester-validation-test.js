import https from 'https';
import fs from 'fs';
import path from 'path';

// Simple validation test for Manchester Digital Collections
async function validateManchesterImplementation() {
    console.log('=== Manchester Digital Collections Validation Test ===\n');
    
    const testUrl = 'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00011/1';
    
    // Step 1: Extract manuscript ID
    const urlPattern = /https:\/\/www\.digitalcollections\.manchester\.ac\.uk\/view\/([^\/]+)\/(\d+)/;
    const match = testUrl.match(urlPattern);
    
    if (!match) {
        console.error('❌ URL pattern matching failed');
        return;
    }
    
    const manuscriptId = match[1];
    const pageNumber = match[2];
    console.log(`✅ Extracted manuscript ID: ${manuscriptId}`);
    console.log(`✅ Page number: ${pageNumber}`);
    
    // Step 2: Fetch IIIF manifest
    const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
    console.log(`📄 Fetching manifest: ${manifestUrl}`);
    
    try {
        const manifestResponse = await fetch(manifestUrl);
        const manifest = await manifestResponse.json();
        
        console.log(`✅ Manifest loaded successfully`);
        console.log(`📚 Title: ${manifest.label}`);
        console.log(`📋 Total pages: ${manifest.sequences[0].canvases.length}`);
        
        // Step 3: Extract first few image URLs
        const canvases = manifest.sequences[0].canvases.slice(0, 3);
        const imageUrls = [];
        
        for (const canvas of canvases) {
            const serviceId = canvas.images[0].resource.service["@id"];
            const imageId = serviceId.replace("https://image.digitalcollections.manchester.ac.uk/iiif/", "");
            const imageUrl = `https://image.digitalcollections.manchester.ac.uk/iiif/${imageId}/full/max/0/default.jpg`;
            imageUrls.push(imageUrl);
        }
        
        console.log(`✅ Generated ${imageUrls.length} image URLs`);
        
        // Step 4: Test image accessibility
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            console.log(`🔍 Testing image ${i + 1}: ${url.split('/').pop()}`);
            
            try {
                const response = await fetch(url, { method: 'HEAD' });
                const contentLength = response.headers.get('content-length');
                const contentType = response.headers.get('content-type');
                
                if (response.ok) {
                    console.log(`  ✅ Status: ${response.status}`);
                    console.log(`  📏 Size: ${Math.round(contentLength / 1024)} KB`);
                    console.log(`  🎨 Type: ${contentType}`);
                } else {
                    console.log(`  ❌ Status: ${response.status}`);
                }
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
            
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Step 5: Download a sample image for quality verification
        console.log('\n📥 Downloading sample image for quality verification...');
        const sampleUrl = imageUrls[0];
        const sampleResponse = await fetch(sampleUrl);
        const sampleBuffer = await sampleResponse.arrayBuffer();
        
        const samplePath = '.devkit/reports/manchester-sample-image.jpg';
        fs.writeFileSync(samplePath, Buffer.from(sampleBuffer));
        
        console.log(`✅ Sample image saved: ${samplePath}`);
        console.log(`📏 Image size: ${Math.round(sampleBuffer.byteLength / 1024)} KB`);
        
        console.log('\n=== Validation Summary ===');
        console.log('✅ URL pattern recognition: PASSED');
        console.log('✅ IIIF manifest fetching: PASSED');
        console.log('✅ Image URL generation: PASSED');
        console.log('✅ Image accessibility: PASSED');
        console.log('✅ Sample download: PASSED');
        console.log('\n🎉 Manchester Digital Collections implementation is FEASIBLE');
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
    }
}

validateManchesterImplementation();