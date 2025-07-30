const https = require('https');
const fs = require('fs');

// Disable SSL verification
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Test URLs with different resolutions
const testUrls = [
    {
        resolution: 'full/max',
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r//full/max/0/default.jpg'
    },
    {
        resolution: 'full/full',
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r//full/full/0/default.jpg'
    },
    {
        resolution: 'full/4000',
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r//full/4000,/0/default.jpg'
    },
    {
        resolution: 'full/2000',
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r//full/2000,/0/default.jpg'
    }
];

async function testImageWithRedirect(testItem) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing ${testItem.resolution}: ${testItem.url}`);
        
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Referer': 'https://nbm.regione.veneto.it/'
            },
            timeout: 30000,
            rejectUnauthorized: false
        };
        
        let redirectCount = 0;
        let currentUrl = testItem.url;
        let finalData = null;
        
        function makeRequest(url) {
            const req = https.request(url, options, (res) => {
                console.log(`   📊 Status: ${res.statusCode}`);
                console.log(`   📋 Content-Type: ${res.headers['content-type']}`);
                console.log(`   📏 Content-Length: ${res.headers['content-length']} bytes`);
                
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const location = res.headers.location;
                    redirectCount++;
                    console.log(`   🔄 Redirect ${redirectCount}: ${location}`);
                    
                    if (redirectCount < 5 && location) {
                        // Follow redirect
                        makeRequest(location);
                        return;
                    } else {
                        console.log(`   ❌ Too many redirects or no location header`);
                        resolve({ success: false, error: 'Too many redirects' });
                        return;
                    }
                }
                
                if (res.statusCode === 200) {
                    let data = Buffer.alloc(0);
                    res.on('data', (chunk) => {
                        data = Buffer.concat([data, chunk]);
                    });
                    
                    res.on('end', () => {
                        console.log(`   ✅ SUCCESS - Image downloaded (${data.length} bytes)`);
                        
                        // Save first successful image as sample
                        if (!finalData && data.length > 1000) {
                            const filename = `/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-sample-${testItem.resolution.replace('/', '-')}.jpg`;
                            fs.writeFileSync(filename, data);
                            console.log(`   💾 Sample saved: ${filename}`);
                            finalData = data;
                        }
                        
                        resolve({ 
                            success: true, 
                            size: data.length, 
                            resolution: testItem.resolution,
                            redirects: redirectCount 
                        });
                    });
                } else {
                    console.log(`   ❌ FAILED - HTTP ${res.statusCode}`);
                    resolve({ success: false, error: `HTTP ${res.statusCode}` });
                }
            });
            
            req.on('error', (error) => {
                console.log(`   ❌ FAILED - ${error.message}`);
                resolve({ success: false, error: error.message });
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.log(`   ❌ FAILED - Timeout`);
                resolve({ success: false, error: 'Timeout' });
            });
            
            req.end();
        }
        
        makeRequest(currentUrl);
    });
}

async function main() {
    console.log('🖼️  Verona NBM Image Resolution Testing');
    console.log('=' .repeat(50));
    
    const results = [];
    
    for (const testItem of testUrls) {
        const result = await testImageWithRedirect(testItem);
        results.push(result);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 SUMMARY RESULTS');
    console.log('=' .repeat(30));
    
    let bestResolution = null;
    let maxSize = 0;
    
    for (const result of results) {
        if (result.success) {
            console.log(`✅ ${result.resolution}: ${result.size} bytes (${result.redirects} redirects)`);
            if (result.size > maxSize) {
                maxSize = result.size;
                bestResolution = result.resolution;
            }
        } else {
            console.log(`❌ ${result.resolution}: ${result.error}`);
        }
    }
    
    if (bestResolution) {
        console.log(`\n🏆 HIGHEST QUALITY: ${bestResolution} (${maxSize} bytes)`);
        console.log(`\n✅ RECOMMENDED IMPLEMENTATION:`);
        console.log(`   Resolution parameter: ${bestResolution}/0/default.jpg`);
        console.log(`   Handle redirects: YES`);
        console.log(`   SSL verification: DISABLED`);
        console.log(`   User-Agent: Required`);
    } else {
        console.log(`\n❌ NO SUCCESSFUL DOWNLOADS - Check authentication requirements`);
    }
    
    console.log('\n🎉 Image testing completed!');
}

main().catch(console.error);