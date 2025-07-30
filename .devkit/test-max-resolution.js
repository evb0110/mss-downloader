const https = require('https');
const fs = require('fs');

// Disable SSL verification
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const baseService = 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r';

// Test progressively higher resolutions
const resolutionTests = [
    'full/6000,/0/default.jpg',
    'full/8000,/0/default.jpg', 
    'full/10000,/0/default.jpg',
    'full/12000,/0/default.jpg',
    'full/15000,/0/default.jpg',
    'full/20000,/0/default.jpg'
];

async function testResolution(resolution) {
    return new Promise((resolve) => {
        const url = `${baseService}/${resolution}`;
        console.log(`\n🧪 Testing ${resolution}: ${url}`);
        
        const startTime = Date.now();
        const req = https.request(url, {
            method: 'HEAD', // Use HEAD to get size without downloading
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            timeout: 15000,
            rejectUnauthorized: false
        }, (res) => {
            const responseTime = Date.now() - startTime;
            console.log(`   📊 Status: ${res.statusCode} (${responseTime}ms)`);
            console.log(`   📋 Content-Type: ${res.headers['content-type']}`);
            console.log(`   📏 Content-Length: ${res.headers['content-length']} bytes`);
            
            if (res.statusCode === 200) {
                const sizeBytes = parseInt(res.headers['content-length']) || 0;
                const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
                console.log(`   ✅ SUCCESS - ${sizeMB} MB`);
                
                resolve({
                    success: true,
                    resolution,
                    sizeBytes,
                    sizeMB: parseFloat(sizeMB),
                    responseTime
                });
            } else {
                console.log(`   ❌ FAILED`);
                resolve({ success: false, resolution, status: res.statusCode });
            }
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ FAILED - ${error.message}`);
            resolve({ success: false, resolution, error: error.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log(`   ❌ FAILED - Timeout`);
            resolve({ success: false, resolution, error: 'Timeout' });
        });
        
        req.end();
    });
}

async function getImageInfo() {
    return new Promise((resolve) => {
        const infoUrl = `${baseService}/info.json`;
        console.log(`📋 Getting image info: ${infoUrl}`);
        
        const req = https.request(infoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    console.log(`   🖼️  Original dimensions: ${info.width} × ${info.height}`);
                    console.log(`   🔧 Profile: ${info.profile}`);
                    console.log(`   📋 Protocol: ${info.protocol}`);
                    resolve(info);
                } catch (error) {
                    console.log(`   ❌ Failed to parse info: ${error.message}`);
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ Info request failed: ${error.message}`);
            resolve(null);
        });
        
        req.end();
    });
}

async function downloadBestQuality(bestResolution) {
    return new Promise((resolve) => {
        const url = `${baseService}/${bestResolution}`;
        console.log(`\n🎯 Downloading best quality sample: ${url}`);
        
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            timeout: 60000, // 1 minute for large downloads
            rejectUnauthorized: false
        }, (res) => {
            if (res.statusCode !== 200) {
                console.log(`   ❌ Download failed: HTTP ${res.statusCode}`);
                resolve(false);
                return;
            }
            
            let data = Buffer.alloc(0);
            let downloadedBytes = 0;
            const totalBytes = parseInt(res.headers['content-length']) || 0;
            
            res.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
                downloadedBytes += chunk.length;
                
                if (totalBytes > 0) {
                    const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                    process.stdout.write(`\r   📥 Progress: ${progress}% (${Math.round(downloadedBytes/1024)} KB)`);
                }
            });
            
            res.on('end', () => {
                console.log(`\n   ✅ Download complete: ${Math.round(data.length/1024)} KB`);
                
                const filename = `/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-max-quality-sample.jpg`;
                fs.writeFileSync(filename, data);
                console.log(`   💾 Saved: ${filename}`);
                
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log(`\n   ❌ Download failed: ${error.message}`);
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log(`\n   ❌ Download timeout`);
            resolve(false);
        });
        
        req.end();
    });
}

async function main() {
    console.log('🔍 Verona NBM Maximum Resolution Testing');
    console.log('=' .repeat(50));
    
    // Get image info first
    const imageInfo = await getImageInfo();
    
    console.log('\n🧪 RESOLUTION TESTING');
    console.log('-' .repeat(30));
    
    const results = [];
    
    for (const resolution of resolutionTests) {
        const result = await testResolution(resolution);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Find the best quality
    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
        const bestQuality = successful.reduce((max, curr) => 
            curr.sizeBytes > max.sizeBytes ? curr : max
        );
        
        console.log('\n🏆 MAXIMUM QUALITY FOUND');
        console.log('-' .repeat(30));
        console.log(`   Resolution: ${bestQuality.resolution}`);
        console.log(`   File Size: ${bestQuality.sizeMB} MB`);
        console.log(`   Response Time: ${bestQuality.responseTime}ms`);
        
        // Download a sample of the best quality
        await downloadBestQuality(bestQuality.resolution);
        
        console.log('\n📊 ALL SUCCESSFUL RESOLUTIONS:');
        successful.forEach(r => {
            console.log(`   • ${r.resolution}: ${r.sizeMB} MB (${r.responseTime}ms)`);
        });
        
        console.log('\n✅ RECOMMENDED SETTINGS:');
        console.log(`   🎯 Maximum Quality: ${bestQuality.resolution}`);
        console.log(`   🎯 High Quality: full/8000,/0/default.jpg`);
        console.log(`   🎯 Standard Quality: full/4000,/0/default.jpg`);
        console.log(`   🎯 Fast Download: full/2000,/0/default.jpg`);
        
    } else {
        console.log('\n❌ No high-resolution versions available');
    }
    
    if (imageInfo) {
        console.log('\n📐 ORIGINAL IMAGE INFO:');
        console.log(`   Dimensions: ${imageInfo.width} × ${imageInfo.height}`);
        console.log(`   Aspect Ratio: ${(imageInfo.width / imageInfo.height).toFixed(2)}`);
        console.log(`   Megapixels: ${((imageInfo.width * imageInfo.height) / 1000000).toFixed(1)}MP`);
    }
    
    console.log('\n🎉 Maximum resolution testing completed!');
}

main().catch(console.error);