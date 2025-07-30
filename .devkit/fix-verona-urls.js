const https = require('https');
const fs = require('fs');

// Disable SSL verification
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Fixed URLs without double slashes and test different patterns
const baseService = 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r';

const testUrls = [
    {
        description: 'Fixed single slash - full/max',
        url: `${baseService}/full/max/0/default.jpg`
    },
    {
        description: 'Fixed single slash - full/full',
        url: `${baseService}/full/full/0/default.jpg`
    },
    {
        description: 'Fixed single slash - full/2000',
        url: `${baseService}/full/2000,/0/default.jpg`
    },
    {
        description: 'Fixed single slash - full/4000',
        url: `${baseService}/full/4000,/0/default.jpg`
    },
    {
        description: 'Info JSON endpoint',
        url: `${baseService}/info.json`
    },
    {
        description: 'Alternative digilib format',
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler?fn=documenti/bibliotecadigitale/nbm/VR0056/LXXXIX+(84)/VR0056-Cod._LXXXIX_(84)_c._001r&ws=1.0'
    },
    {
        description: 'Simple direct image request',
        url: `${baseService}.jpg`
    }
];

async function testUrl(testItem) {
    return new Promise((resolve) => {
        console.log(`\n🧪 ${testItem.description}`);
        console.log(`   🔗 ${testItem.url}`);
        
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://nbm.regione.veneto.it/',
                'Cache-Control': 'no-cache'
            },
            timeout: 20000,
            rejectUnauthorized: false
        };
        
        const req = https.request(testItem.url, options, (res) => {
            console.log(`   📊 Status: ${res.statusCode}`);
            console.log(`   📋 Content-Type: ${res.headers['content-type']}`);
            console.log(`   📏 Content-Length: ${res.headers['content-length']} bytes`);
            
            if (res.statusCode === 301 || res.statusCode === 302) {
                console.log(`   🔄 Redirect to: ${res.headers.location}`);
                resolve({ success: false, redirect: res.headers.location });
                return;
            }
            
            if (res.statusCode === 200) {
                let data = Buffer.alloc(0);
                let chunks = 0;
                
                res.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                    chunks++;
                    if (chunks === 1) {
                        console.log(`   📥 First chunk received...`);
                    }
                });
                
                res.on('end', () => {
                    console.log(`   ✅ SUCCESS - Downloaded ${data.length} bytes`);
                    
                    if (data.length > 1000) {
                        // Save successful downloads
                        const filename = `/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-success-${Date.now()}.jpg`;
                        fs.writeFileSync(filename, data);
                        console.log(`   💾 Saved: ${filename}`);
                        
                        // Try to identify if it's a real image
                        const isJPEG = data[0] === 0xFF && data[1] === 0xD8;
                        const isPNG = data[0] === 0x89 && data[1] === 0x50;
                        console.log(`   🖼️  Image format: ${isJPEG ? 'JPEG' : isPNG ? 'PNG' : 'Unknown'}`);
                    }
                    
                    resolve({ 
                        success: true, 
                        size: data.length,
                        contentType: res.headers['content-type']
                    });
                });
            } else {
                console.log(`   ❌ FAILED - HTTP ${res.statusCode}`);
                resolve({ success: false, status: res.statusCode });
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
    });
}

async function main() {
    console.log('🔧 Verona NBM URL Structure Testing');
    console.log('=' .repeat(50));
    
    const results = [];
    
    for (const testItem of testUrls) {
        const result = await testUrl(testItem);
        results.push({ test: testItem.description, result });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('\n📊 SUMMARY RESULTS');
    console.log('=' .repeat(30));
    
    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);
    
    if (successful.length > 0) {
        console.log(`\n✅ SUCCESSFUL TESTS (${successful.length}):`);
        successful.forEach(r => {
            console.log(`   • ${r.test}: ${r.result.size} bytes (${r.result.contentType})`);
        });
        
        const largest = successful.reduce((max, curr) => 
            curr.result.size > max.result.size ? curr : max
        );
        console.log(`\n🏆 HIGHEST QUALITY: ${largest.test} (${largest.result.size} bytes)`);
    }
    
    if (failed.length > 0) {
        console.log(`\n❌ FAILED TESTS (${failed.length}):`);
        failed.forEach(r => {
            const reason = r.result.redirect ? `Redirect to ${r.result.redirect}` : 
                          r.result.error || `HTTP ${r.result.status}`;
            console.log(`   • ${r.test}: ${reason}`);
        });
    }
    
    console.log('\n🎉 URL structure testing completed!');
}

main().catch(console.error);