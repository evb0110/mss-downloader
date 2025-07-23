const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

async function testFlorenceTimeout() {
    console.log('=== Florence CDM Timeout Investigation ===\n');
    
    const loader = new SharedManifestLoaders(fetchFn);
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log('Testing Florence manuscript:', url);
        console.log('Checking if manifest can be extracted...\n');
        
        const result = await loader.getManifestForLibrary('florence', url);
        
        console.log(`✅ SUCCESS: Found ${result.images.length} pages`);
        console.log('First few image URLs:');
        
        for (let i = 0; i < Math.min(3, result.images.length); i++) {
            console.log(`Page ${i + 1}: ${result.images[i].url}`);
        }
        
        // Test downloading a sample page
        if (result.images.length > 0) {
            console.log('\nTesting sample download...');
            const testImage = result.images[0];
            
            const validationDir = path.join(__dirname, 'validation-results', 'FLORENCE_TIMEOUT_TEST');
            if (!fs.existsSync(validationDir)) {
                fs.mkdirSync(validationDir, { recursive: true });
            }
            
            const filepath = path.join(validationDir, 'florence_test.jpg');
            
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(filepath);
                https.get(testImage.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Referer': 'https://cdm21059.contentdm.oclc.org/'
                    }
                }, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
            
            const stats = fs.statSync(filepath);
            console.log(`✅ Sample download successful: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Clean up
            fs.unlinkSync(filepath);
            fs.rmdirSync(validationDir);
        }
        
        console.log('\n✅ Florence CDM is working correctly');
        console.log('The timeout issue may be user-specific or resolved');
        
    } catch (error) {
        console.error('❌ Florence test failed:', error.message);
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
            console.error('🔍 Confirmed: Florence CDM timeout issue exists');
            console.error('This may be a temporary server issue or network connectivity problem');
        }
    }
}

testFlorenceTimeout().catch(console.error);