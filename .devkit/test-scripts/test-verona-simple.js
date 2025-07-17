const https = require('https');
const fs = require('fs');
const path = require('path');

async function fetchWithTimeout(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const parsedUrl = new URL(url);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, application/ld+json, */*;q=0.8'
            },
            rejectUnauthorized: false,
            timeout: timeout
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const elapsed = Date.now() - startTime;
                resolve({ 
                    status: res.statusCode, 
                    data, 
                    elapsed,
                    headers: res.headers 
                });
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout after ${timeout}ms`));
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function testVeronaManifests() {
    console.log('=== Testing Verona NBM Manifest Access ===\n');
    
    const manifests = [
        { codice: '14', id: 'CVII1001' },
        { codice: '15', id: 'LXXXIX841' },
        { codice: '16', id: 'CVI913' },  // This one might not exist
        { codice: '17', id: 'msClasseIII81' }
    ];
    
    const results = [];
    
    for (const manifest of manifests) {
        console.log(`\nTesting codice=${manifest.codice} (${manifest.id}):`);
        
        const manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifest.id}.json`;
        
        try {
            const response = await fetchWithTimeout(manifestUrl);
            
            if (response.status === 200) {
                const data = JSON.parse(response.data);
                const pageCount = data.sequences?.[0]?.canvases?.length || 0;
                
                console.log(`✓ Success in ${response.elapsed}ms`);
                console.log(`  Title: ${data.label || 'No title'}`);
                console.log(`  Pages: ${pageCount}`);
                
                // Test first image
                if (pageCount > 0) {
                    const firstImage = data.sequences[0].canvases[0].images[0].resource['@id'];
                    console.log(`  Testing first image...`);
                    
                    try {
                        const imgResponse = await fetchWithTimeout(firstImage.replace('http:', 'https:'), 10000);
                        console.log(`  ✓ Image accessible (${imgResponse.status}) - ${imgResponse.headers['content-length']} bytes`);
                    } catch (imgError) {
                        console.log(`  ✗ Image failed: ${imgError.message}`);
                    }
                }
                
                results.push({
                    codice: manifest.codice,
                    id: manifest.id,
                    status: 'success',
                    responseTime: response.elapsed,
                    pageCount
                });
                
            } else {
                console.log(`✗ HTTP ${response.status} in ${response.elapsed}ms`);
                results.push({
                    codice: manifest.codice,
                    id: manifest.id,
                    status: 'failed',
                    httpStatus: response.status,
                    responseTime: response.elapsed
                });
            }
            
        } catch (error) {
            console.log(`✗ Error: ${error.message}`);
            results.push({
                codice: manifest.codice,
                id: manifest.id,
                status: 'error',
                error: error.message
            });
        }
    }
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const successful = results.filter(r => r.status === 'success').length;
    console.log(`Successful: ${successful}/${results.length}`);
    
    console.log('\nAverage response time for successful requests:');
    const avgTime = results
        .filter(r => r.status === 'success')
        .reduce((sum, r) => sum + r.responseTime, 0) / successful;
    console.log(`${avgTime.toFixed(0)}ms`);
    
    // Write report
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(reportDir, 'verona-manifest-test.json'),
        JSON.stringify({ testDate: new Date().toISOString(), results }, null, 2)
    );
    
    console.log('\nReport saved to .devkit/reports/verona-manifest-test.json');
}

testVeronaManifests().catch(console.error);