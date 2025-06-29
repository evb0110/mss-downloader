const https = require('https');

const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';

console.log('Testing University of Graz IIIF manifest download with timing...');
console.log(`Manifest URL: ${manifestUrl}`);

const startTime = Date.now();

// Test with 2 minute timeout
const controller = new AbortController();
const timeout = setTimeout(() => {
    controller.abort();
    console.log('❌ Request aborted after 2 minutes');
}, 120000);

const options = {
    headers: {
        'Accept': 'application/json, application/ld+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    signal: controller.signal
};

https.get(manifestUrl, options, (response) => {
    console.log(`Status: ${response.statusCode}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length']}`);
    
    let data = '';
    let dataSize = 0;
    
    response.on('data', (chunk) => {
        data += chunk;
        dataSize += chunk.length;
        
        // Log progress every 50KB
        if (dataSize % 50000 < chunk.length) {
            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`Downloaded ${dataSize} bytes in ${elapsed.toFixed(1)}s`);
        }
    });
    
    response.on('end', () => {
        clearTimeout(timeout);
        const elapsed = (Date.now() - startTime) / 1000;
        
        console.log(`✅ Download completed in ${elapsed.toFixed(1)}s`);
        console.log(`Total size: ${dataSize} bytes (${(dataSize/1024).toFixed(1)}KB)`);
        
        try {
            const manifest = JSON.parse(data);
            const canvasCount = manifest.sequences?.[0]?.canvases?.length || 0;
            console.log(`Manifest parsed successfully: ${canvasCount} canvases found`);
            
            if (manifest.label) {
                console.log(`Title: ${JSON.stringify(manifest.label)}`);
            }
        } catch (parseError) {
            console.log('❌ Failed to parse JSON:', parseError.message);
        }
    });
}).on('error', (err) => {
    clearTimeout(timeout);
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (err.name === 'AbortError') {
        console.log(`❌ Request timed out after ${elapsed.toFixed(1)}s`);
    } else {
        console.log(`❌ Request failed after ${elapsed.toFixed(1)}s:`, err.message);
    }
});