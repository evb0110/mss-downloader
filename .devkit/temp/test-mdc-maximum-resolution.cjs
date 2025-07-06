const https = require('https');
const fs = require('fs');
const path = require('path');

// Test maximum resolution for MDC Catalonia
const pageId = '174519'; // First page ID from the compound object
const collection = 'incunableBC';

const resolutionTests = [
    'full/full/0/default.jpg',
    'full/max/0/default.jpg', 
    'full/,4000/0/default.jpg',
    'full/,3000/0/default.jpg',
    'full/,2000/0/default.jpg',
    'full/,1500/0/default.jpg',
    'full/,1000/0/default.jpg'
];

async function testResolution(resolution) {
    const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/${resolution}`;
    
    return new Promise((resolve, reject) => {
        const req = https.get(imageUrl, (res) => {
            if (res.statusCode !== 200) {
                resolve({ resolution, status: res.statusCode, size: 0 });
                return;
            }
            
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
            });
            
            res.on('end', () => {
                resolve({ resolution, status: res.statusCode, size });
            });
        });
        
        req.on('error', (err) => {
            resolve({ resolution, status: 'error', size: 0, error: err.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ resolution, status: 'timeout', size: 0 });
        });
    });
}

async function runResolutionTests() {
    console.log('Testing maximum resolution for MDC Catalonia...');
    console.log(`Page ID: ${pageId}`);
    
    const results = [];
    
    for (const resolution of resolutionTests) {
        const result = await testResolution(resolution);
        results.push(result);
        console.log(`${resolution}: ${result.status} - ${(result.size / 1024 / 1024).toFixed(2)}MB`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Find the best resolution
    const validResults = results.filter(r => r.status === 200);
    const bestResult = validResults.reduce((best, current) => 
        current.size > best.size ? current : best
    );
    
    console.log('\n=== BEST RESOLUTION ===');
    console.log(`Resolution: ${bestResult.resolution}`);
    console.log(`Size: ${(bestResult.size / 1024 / 1024).toFixed(2)}MB`);
    
    return bestResult;
}

runResolutionTests().catch(console.error);