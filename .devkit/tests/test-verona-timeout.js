const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');

app.disableHardwareAcceleration();

const TEST_OUTPUT_DIR = path.join(__dirname, '../test-outputs', 'verona-timeout-test');

async function ensureDirectory(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
    }
}

async function testVeronaDirectConnection() {
    console.log('Testing Verona Library direct connection...');
    
    const testUrls = [
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=16'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
        console.log(`\nTesting URL: ${url}`);
        const startTime = Date.now();
        
        try {
            const response = await new Promise((resolve, reject) => {
                const parsedUrl = new URL(url);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: 443,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    rejectUnauthorized: false,
                    timeout: 30000
                };
                
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({ 
                            status: res.statusCode, 
                            data, 
                            headers: res.headers,
                            time: Date.now() - startTime 
                        });
                    });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                
                req.on('error', reject);
                req.end();
            });
            
            console.log(`Response received in ${response.time}ms`);
            console.log(`Status: ${response.status}`);
            console.log(`Content length: ${response.data.length} bytes`);
            
            // Extract manifest URL
            const manifestMatch = response.data.match(/nbm\.regione\.veneto\.it[^"']+manifest[^"']+\.json/);
            if (manifestMatch) {
                console.log(`Found manifest URL: https://${manifestMatch[0]}`);
                results.push({
                    url,
                    status: 'success',
                    responseTime: response.time,
                    manifestUrl: `https://${manifestMatch[0]}`
                });
            } else {
                console.log('No manifest URL found in response');
                results.push({
                    url,
                    status: 'no_manifest',
                    responseTime: response.time
                });
            }
            
        } catch (error) {
            console.error(`Failed: ${error.message}`);
            results.push({
                url,
                status: 'failed',
                error: error.message,
                time: Date.now() - startTime
            });
        }
    }
    
    return results;
}

async function testVeronaWithService() {
    console.log('\n\nTesting Verona with EnhancedManuscriptDownloaderService...');
    
    try {
        const { EnhancedManuscriptDownloaderService } = require(path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService'));
        const service = new EnhancedManuscriptDownloaderService();
        
        const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
        console.log(`\nTesting URL: ${testUrl}`);
        
        const startTime = Date.now();
        
        try {
            const manifest = await service.loadManifest(testUrl);
            const loadTime = Date.now() - startTime;
            
            console.log(`Manifest loaded in ${loadTime}ms`);
            console.log(`Title: ${manifest.title}`);
            console.log(`Total pages: ${manifest.totalPages}`);
            
            if (manifest.images && manifest.images.length > 0) {
                console.log(`\nTesting first image download...`);
                const imageStart = Date.now();
                
                try {
                    const imageData = await service.downloadImageWithRetries(manifest.images[0]);
                    const imageTime = Date.now() - imageStart;
                    
                    console.log(`Image downloaded in ${imageTime}ms`);
                    console.log(`Image size: ${(imageData.byteLength / 1024).toFixed(2)} KB`);
                    
                    return {
                        status: 'success',
                        manifestLoadTime: loadTime,
                        imageDownloadTime: imageTime,
                        totalPages: manifest.totalPages,
                        firstImageSize: imageData.byteLength
                    };
                } catch (imageError) {
                    console.error(`Image download failed: ${imageError.message}`);
                    return {
                        status: 'image_failed',
                        manifestLoadTime: loadTime,
                        imageError: imageError.message,
                        totalPages: manifest.totalPages
                    };
                }
            }
            
        } catch (error) {
            console.error(`Manifest loading failed: ${error.message}`);
            return {
                status: 'manifest_failed',
                error: error.message,
                time: Date.now() - startTime
            };
        }
        
    } catch (error) {
        console.error('Service test failed:', error);
        return {
            status: 'service_error',
            error: error.message
        };
    }
}

app.whenReady().then(async () => {
    await ensureDirectory(TEST_OUTPUT_DIR);
    
    console.log('=== Verona Library Timeout Investigation ===\n');
    
    // Test 1: Direct connection
    const directResults = await testVeronaDirectConnection();
    
    // Test 2: Service test
    const serviceResult = await testVeronaWithService();
    
    // Generate report
    const report = {
        testDate: new Date().toISOString(),
        directConnectionTests: directResults,
        serviceTest: serviceResult,
        analysis: {
            directConnectionSuccess: directResults.filter(r => r.status === 'success').length,
            directConnectionFailed: directResults.filter(r => r.status === 'failed').length,
            avgResponseTime: directResults
                .filter(r => r.responseTime)
                .reduce((sum, r) => sum + r.responseTime, 0) / directResults.filter(r => r.responseTime).length || 0
        }
    };
    
    await fs.writeFile(
        path.join(TEST_OUTPUT_DIR, 'verona-timeout-analysis.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== Test Summary ===');
    console.log(`Direct connection: ${report.analysis.directConnectionSuccess}/${directResults.length} successful`);
    console.log(`Average response time: ${report.analysis.avgResponseTime.toFixed(0)}ms`);
    console.log(`Service test: ${serviceResult.status}`);
    console.log(`\nDetailed report saved to: ${path.join(TEST_OUTPUT_DIR, 'verona-timeout-analysis.json')}`);
    
    app.quit();
});