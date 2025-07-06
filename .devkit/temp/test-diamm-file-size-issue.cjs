#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

async function testDiammResolution() {
    const targetUrl = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';
    console.log('Testing DIAMM file size issue...');
    console.log('Target URL:', targetUrl);
    
    try {
        // Extract manifest URL
        const urlParams = new URLSearchParams(targetUrl.split('?')[1]);
        const manifestUrl = decodeURIComponent(urlParams.get('manifest'));
        console.log('Manifest URL:', manifestUrl);
        
        // Fetch manifest
        const manifestResponse = await fetch(manifestUrl);
        const manifest = await manifestResponse.json();
        console.log('Manifest loaded successfully');
        console.log('Total canvases:', manifest.sequences[0].canvases.length);
        
        // Test first few pages with different resolutions
        const testCanvases = manifest.sequences[0].canvases.slice(0, 3);
        
        for (let i = 0; i < testCanvases.length; i++) {
            const canvas = testCanvases[i];
            const imageResource = canvas.images[0].resource;
            
            // Extract base image URL
            let baseImageUrl = imageResource.service ? imageResource.service['@id'] : imageResource['@id'];
            console.log(`\nTesting canvas ${i + 1}: ${canvas.label || 'Unlabeled'}`);
            console.log('Base image URL:', baseImageUrl);
            
            // Test different resolutions
            const resolutions = ['full/max', 'full/2000,', 'full/1000,', 'full/500,'];
            
            for (const resolution of resolutions) {
                const testUrl = `${baseImageUrl}/${resolution}/0/default.jpg`;
                console.log(`\nTesting resolution: ${resolution}`);
                console.log('Test URL:', testUrl);
                
                try {
                    const response = await fetch(testUrl, { method: 'HEAD' });
                    const contentLength = response.headers.get('content-length');
                    const contentType = response.headers.get('content-type');
                    
                    console.log(`Status: ${response.status}`);
                    console.log(`Content-Length: ${contentLength} bytes`);
                    console.log(`Content-Type: ${contentType}`);
                    
                    if (response.ok && contentLength) {
                        const sizeKB = Math.round(parseInt(contentLength) / 1024);
                        console.log(`File size: ${sizeKB} KB`);
                        
                        // Download the image for size comparison
                        const downloadResponse = await fetch(testUrl);
                        const buffer = await downloadResponse.arrayBuffer();
                        const filename = `diamm-1907-page${i + 1}-${resolution.replace('/', '-')}.jpg`;
                        const filepath = path.join(__dirname, '..', 'reports', filename);
                        
                        fs.writeFileSync(filepath, Buffer.from(buffer));
                        console.log(`Downloaded: ${filename} (${buffer.byteLength} bytes)`);
                        
                        // Check if file size matches expected
                        if (buffer.byteLength < 100000) { // Less than 100KB
                            console.log('⚠️  WARNING: File size is very small, may indicate low resolution');
                        } else if (buffer.byteLength > 1000000) { // Greater than 1MB
                            console.log('✅ Good file size, high resolution confirmed');
                        }
                    }
                } catch (error) {
                    console.log(`Error testing ${resolution}:`, error.message);
                }
            }
        }
        
        console.log('\n=== DIAMM File Size Analysis Complete ===');
        
    } catch (error) {
        console.error('Error in DIAMM analysis:', error);
    }
}

testDiammResolution();