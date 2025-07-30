const https = require('https');
const fs = require('fs');

// Disable SSL verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const testCases = [
    // URLs based on the codebase examples
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        description: 'Codebase example URL pattern (caricaVolumi.html?codice=15)'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
        description: 'Test with codice=14'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=1',
        description: 'Test with codice=1'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=16',
        description: 'Test with codice=16'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=100',
        description: 'Test with high codice=100'
    },
    
    // Alternative domain URLs
    {
        url: 'https://nbm.regione.veneto.it/',
        description: 'Alternative NBM domain root'
    },
    {
        url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json',
        description: 'Direct IIIF manifest URL from tests'
    },
    {
        url: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/CVII1001.json',
        description: 'Another direct IIIF manifest URL from tests'
    },
    
    // Original visualizza.html URLs for comparison
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1',
        description: 'Original URL pattern (visualizza.html?codiceDigital=15&volume=1)'
    },
    {
        url: 'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=15&volume=1',
        description: 'Original URL pattern without /Generale/BibliotecaDigitale/'
    }
];

async function testUrl(testCase) {
    return new Promise((resolve) => {
        console.log(`\nTesting: ${testCase.description}`);
        console.log(`URL: ${testCase.url}`);
        
        const req = https.get(testCase.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const result = {
                    url: testCase.url,
                    description: testCase.description,
                    statusCode: res.statusCode,
                    contentLength: data.length,
                    isSuccess: res.statusCode === 200,
                    contentType: res.headers['content-type'],
                    observations: []
                };
                
                // Analyze content
                if (result.isSuccess) {
                    if (data.includes('manifest') || data.includes('IIIF')) {
                        result.observations.push('Contains IIIF/manifest references');
                    }
                    if (data.includes('codice') || data.includes('manoscritto')) {
                        result.observations.push('Contains manuscript references');
                    }
                    if (data.includes('viewer') || data.includes('visualizza')) {
                        result.observations.push('Contains viewer interface elements');
                    }
                    if (testCase.url.endsWith('.json')) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed['@context'] && parsed.sequences) {
                                result.observations.push('Valid IIIF manifest JSON');
                            }
                        } catch (e) {
                            result.observations.push('Invalid JSON structure');
                        }
                    }
                } else {
                    if (data.includes('404') || data.includes('not found') || data.includes('non trovato')) {
                        result.observations.push('404 error page');
                    }
                    if (data.includes('pagina richiesta non')) {
                        result.observations.push('Italian "page not found" message');
                    }
                }
                
                console.log(`Status: ${result.statusCode} ${result.isSuccess ? '✅' : '❌'}`);
                console.log(`Content Type: ${result.contentType || 'N/A'}`);
                console.log(`Content Length: ${result.contentLength} bytes`);
                console.log(`Observations: ${result.observations.join(', ') || 'None'}`);
                
                resolve(result);
            });
        });
        
        req.on('error', (err) => {
            console.log(`❌ Error: ${err.message}`);
            resolve({
                url: testCase.url,
                description: testCase.description,
                error: err.message,
                statusCode: null,
                isSuccess: false,
                observations: ['Network error occurred']
            });
        });
        
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({
                url: testCase.url,
                description: testCase.description,
                error: 'Timeout',
                statusCode: null,
                isSuccess: false,
                observations: ['Request timeout']
            });
        });
    });
}

async function runAllTests() {
    console.log('Testing Verona NBM URLs based on codebase patterns');
    console.log('==================================================');
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testUrl(testCase);
        results.push(result);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate analysis
    console.log('\n\nANALYSIS');
    console.log('=========');
    
    const successful = results.filter(r => r.isSuccess);
    const failed = results.filter(r => !r.isSuccess);
    
    console.log(`✅ Successful requests: ${successful.length}`);
    console.log(`❌ Failed requests: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\n📋 WORKING URLs:');
        successful.forEach(r => {
            console.log(`  ✅ ${r.description}`);
            console.log(`     ${r.url}`);
            console.log(`     Status: ${r.statusCode}, Size: ${r.contentLength} bytes`);
            if (r.observations.length > 0) {
                console.log(`     Features: ${r.observations.join(', ')}`);
            }
            console.log('');
        });
    }
    
    if (failed.length > 0) {
        console.log('\n❌ FAILED URLs:');
        failed.forEach(r => {
            console.log(`  ❌ ${r.description}`);
            console.log(`     ${r.url}`);
            console.log(`     Issue: ${r.error || `HTTP ${r.statusCode}`}`);
            console.log('');
        });
    }
    
    // Save results
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length
        },
        workingUrls: successful,
        failedUrls: failed,
        analysis: {
            urlPatterns: {
                caricaVolumi: successful.filter(r => r.url.includes('caricaVolumi.html')).length,
                visualizza: successful.filter(r => r.url.includes('visualizza.html')).length,
                directManifest: successful.filter(r => r.url.includes('manifest') && r.url.endsWith('.json')).length,
                nbmDomain: successful.filter(r => r.url.includes('nbm.regione.veneto.it')).length,
                nuovaBiblioteca: successful.filter(r => r.url.includes('nuovabibliotecamanoscritta.it')).length
            }
        }
    };
    
    fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-url-analysis.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Detailed results saved to .devkit/verona-url-analysis.json');
    
    return results;
}

runAllTests().catch(console.error);