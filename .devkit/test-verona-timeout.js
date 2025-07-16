const https = require('https');

// Test URL from report
const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';

// Known mapping
const manuscriptMap = {
    '15': 'LXXXIX841'
};

console.log('🧪 Testing Verona Library timeout issue...\n');

// Test 1: Interface URL
async function testInterfaceUrl() {
    console.log('1️⃣ Testing interface URL...');
    console.log(`   URL: ${testUrl}`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        https.get(testUrl, { timeout: 30000 }, (res) => {
            const duration = Date.now() - startTime;
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response time: ${duration}ms`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`   Content length: ${data.length} bytes`);
                console.log(`   Content type: ${res.headers['content-type']}`);
                console.log(`   ✅ Interface URL accessible\n`);
                resolve();
            });
        }).on('error', (err) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Error after ${duration}ms: ${err.message}\n`);
            resolve();
        }).on('timeout', () => {
            console.log(`   ❌ Timeout after 30 seconds\n`);
            resolve();
        });
    });
}

// Test 2: IIIF Manifest URL
async function testManifestUrl() {
    const manifestId = manuscriptMap['15'];
    const manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifestId}.json`;
    
    console.log('2️⃣ Testing IIIF manifest URL...');
    console.log(`   Manuscript ID: ${manifestId}`);
    console.log(`   URL: ${manifestUrl}`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        https.get(manifestUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            rejectUnauthorized: false
        }, (res) => {
            const duration = Date.now() - startTime;
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response time: ${duration}ms`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`   Content length: ${data.length} bytes`);
                
                try {
                    const manifest = JSON.parse(data);
                    const canvases = manifest.sequences?.[0]?.canvases || [];
                    console.log(`   📄 Pages found: ${canvases.length}`);
                    console.log(`   📚 Title: ${manifest.label || 'No title'}`);
                    console.log(`   ✅ IIIF manifest loaded successfully\n`);
                } catch (e) {
                    console.log(`   ⚠️ Could not parse manifest JSON\n`);
                }
                resolve();
            });
        }).on('error', (err) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Error after ${duration}ms: ${err.message}\n`);
            resolve();
        }).on('timeout', () => {
            console.log(`   ❌ Timeout after 30 seconds\n`);
            resolve();
        });
    });
}

// Test 3: Try multiple times to check for intermittent issues
async function testMultipleTimes() {
    console.log('3️⃣ Testing multiple requests to check for intermittent issues...');
    
    const results = [];
    for (let i = 1; i <= 5; i++) {
        const manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json`;
        const startTime = Date.now();
        
        await new Promise((resolve) => {
            https.get(manifestUrl, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                },
                rejectUnauthorized: false
            }, (res) => {
                const duration = Date.now() - startTime;
                results.push({ attempt: i, status: res.statusCode, duration, error: null });
                res.destroy();
                resolve();
            }).on('error', (err) => {
                const duration = Date.now() - startTime;
                results.push({ attempt: i, status: null, duration, error: err.message });
                resolve();
            }).on('timeout', () => {
                results.push({ attempt: i, status: null, duration: 10000, error: 'timeout' });
                resolve();
            });
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n   Results:');
    results.forEach(r => {
        if (r.error) {
            console.log(`   Attempt ${r.attempt}: ❌ ${r.error} (${r.duration}ms)`);
        } else {
            console.log(`   Attempt ${r.attempt}: ✅ HTTP ${r.status} (${r.duration}ms)`);
        }
    });
    
    const successRate = results.filter(r => !r.error).length / results.length * 100;
    console.log(`\n   Success rate: ${successRate}%`);
}

// Run all tests
async function runTests() {
    await testInterfaceUrl();
    await testManifestUrl();
    await testMultipleTimes();
    
    console.log('\n✅ All tests completed');
}

runTests().catch(console.error);