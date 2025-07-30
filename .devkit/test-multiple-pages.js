const https = require('https');
const fs = require('fs');

// Disable SSL verification
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Test different pages to find highest resolution originals
const testPages = [
    'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r',
    'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._002r',
    'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._003r',
    'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._010r',
    'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._050r'
];

async function getPageInfo(serviceUrl, pageNum) {
    return new Promise((resolve) => {
        const infoUrl = `${serviceUrl}/info.json`;
        console.log(`\n📄 Page ${pageNum} Info: ${infoUrl}`);
        
        const req = https.request(infoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            timeout: 10000,
            rejectUnauthorized: false
        }, (res) => {
            if (res.statusCode !== 200) {
                console.log(`   ❌ Failed: HTTP ${res.statusCode}`);
                resolve(null);
                return;
            }
            
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    console.log(`   📐 Dimensions: ${info.width} × ${info.height}`);
                    console.log(`   🔍 Megapixels: ${((info.width * info.height) / 1000000).toFixed(1)}MP`);
                    console.log(`   📋 Profile: ${info.profile}`);
                    
                    resolve({
                        pageNum,
                        serviceUrl,
                        width: info.width,
                        height: info.height,
                        megapixels: (info.width * info.height) / 1000000,
                        profile: info.profile
                    });
                } catch (error) {
                    console.log(`   ❌ JSON parse error: ${error.message}`);
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ Request error: ${error.message}`);
            resolve(null);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log(`   ❌ Timeout`);
            resolve(null);
        });
        
        req.end();
    });
}

async function testResolutionForPage(serviceUrl, pageNum) {
    const resolutions = ['full/max', 'full/full', 'full/4000,', 'full/6000,', 'full/8000,'];
    
    console.log(`\n🧪 Testing resolutions for Page ${pageNum}:`);
    
    const results = [];
    
    for (const resolution of resolutions) {
        const url = `${serviceUrl}/${resolution}/0/default.jpg`;
        
        const result = await new Promise((resolve) => {
            const req = https.request(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/*',
                    'Referer': 'https://nbm.regione.veneto.it/'
                },
                timeout: 10000,
                rejectUnauthorized: false
            }, (res) => {
                const sizeBytes = parseInt(res.headers['content-length']) || 0;
                const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
                
                console.log(`   ${resolution}: ${res.statusCode === 200 ? '✅' : '❌'} ${sizeMB}MB`);
                
                resolve({
                    resolution,
                    success: res.statusCode === 200,
                    sizeBytes,
                    sizeMB: parseFloat(sizeMB)
                });
            });
            
            req.on('error', () => {
                console.log(`   ${resolution}: ❌ Error`);
                resolve({ resolution, success: false, sizeBytes: 0, sizeMB: 0 });
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.log(`   ${resolution}: ❌ Timeout`);
                resolve({ resolution, success: false, sizeBytes: 0, sizeMB: 0 });
            });
            
            req.end();
        });
        
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    return results;
}

async function downloadSample(serviceUrl, resolution, pageNum) {
    return new Promise((resolve) => {
        const url = `${serviceUrl}/${resolution}/0/default.jpg`;
        console.log(`\n📥 Downloading Page ${pageNum} sample (${resolution}): ${url}`);
        
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Mac) AppleWebKit/537.36',
                'Accept': 'image/*',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            timeout: 30000,
            rejectUnauthorized: false
        }, (res) => {
            if (res.statusCode !== 200) {
                console.log(`   ❌ Failed: HTTP ${res.statusCode}`);
                resolve(false);
                return;
            }
            
            let data = Buffer.alloc(0);
            res.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
            });
            
            res.on('end', () => {
                const filename = `/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-page-${pageNum}-${resolution.replace('/', '-')}.jpg`;
                fs.writeFileSync(filename, data);
                console.log(`   ✅ Saved: ${filename} (${Math.round(data.length/1024)}KB)`);
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ Error: ${error.message}`);
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log(`   ❌ Timeout`);
            resolve(false);
        });
        
        req.end();
    });
}

async function main() {
    console.log('📚 Verona NBM Multi-Page Resolution Analysis');
    console.log('=' .repeat(50));
    
    const pageInfos = [];
    
    // Get info for all test pages
    for (let i = 0; i < testPages.length; i++) {
        const info = await getPageInfo(testPages[i], i + 1);
        if (info) pageInfos.push(info);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Find the highest resolution page
    const bestPage = pageInfos.reduce((max, curr) => 
        curr.megapixels > max.megapixels ? curr : max
    );
    
    console.log('\n🏆 HIGHEST RESOLUTION PAGE FOUND:');
    console.log(`   Page ${bestPage.pageNum}: ${bestPage.width}×${bestPage.height} (${bestPage.megapixels.toFixed(1)}MP)`);
    
    // Test resolutions for the best page
    const resolutionResults = await testResolutionForPage(bestPage.serviceUrl, bestPage.pageNum);
    
    // Find best resolution for that page
    const successfulResolutions = resolutionResults.filter(r => r.success && r.sizeBytes > 0);
    if (successfulResolutions.length > 0) {
        const bestResolution = successfulResolutions.reduce((max, curr) => 
            curr.sizeBytes > max.sizeBytes ? curr : max
        );
        
        console.log(`\n🎯 BEST QUALITY FOR HIGHEST RES PAGE: ${bestResolution.resolution} (${bestResolution.sizeMB}MB)`);
        
        // Download sample of best quality
        await downloadSample(bestPage.serviceUrl, bestResolution.resolution, bestPage.pageNum);
    }
    
    // Summary of all pages
    console.log('\n📊 ALL PAGES SUMMARY:');
    pageInfos.forEach(info => {
        console.log(`   Page ${info.pageNum}: ${info.width}×${info.height} (${info.megapixels.toFixed(1)}MP)`);
    });
    
    console.log('\n✅ FINAL RECOMMENDATIONS:');
    console.log(`   🎯 Original Resolution: ${bestPage.width}×${bestPage.height}`);
    console.log(`   🎯 Best Quality Parameter: full/max/0/default.jpg OR full/full/0/default.jpg`);
    console.log(`   🎯 High Quality Option: full/4000,/0/default.jpg (upscaled if needed)`);
    console.log(`   🎯 URL Pattern: [service_url]/[resolution_param]`);
    console.log(`   🎯 SSL: Requires rejectUnauthorized: false`);
    console.log(`   🎯 Headers: User-Agent and Referer recommended`);
    
    console.log('\n🎉 Multi-page analysis completed!');
}

main().catch(console.error);