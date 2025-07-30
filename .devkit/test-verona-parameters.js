const https = require('https');
const fs = require('fs');

// Disable SSL verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const baseUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/VisualizzaVolume/visualizza.html';

const testCases = [
    { codiceDigital: 15, volume: 1, description: 'Original parameters' },
    { codiceDigital: 15, volume: 2, description: 'Same codice, volume 2' },
    { codiceDigital: 15, volume: 3, description: 'Same codice, volume 3' },
    { codiceDigital: 16, volume: 1, description: 'Next codice, volume 1' },
    { codiceDigital: 14, volume: 1, description: 'Previous codice, volume 1' },
    { codiceDigital: 1, volume: 1, description: 'First codice, volume 1' },
    { codiceDigital: 100, volume: 1, description: 'High codice, volume 1' },
    { codiceDigital: 50, volume: 1, description: 'Mid-range codice, volume 1' },
    { codiceDigital: 15, volume: 0, description: 'Volume 0 test' },
    { codiceDigital: 15, volume: 10, description: 'High volume test' }
];

async function testUrl(codiceDigital, volume, description) {
    return new Promise((resolve) => {
        const url = `${baseUrl}?codiceDigital=${codiceDigital}&volume=${volume}`;
        console.log(`\nTesting: ${description}`);
        console.log(`URL: ${url}`);
        
        const req = https.get(url, {
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
                    codiceDigital,
                    volume,
                    description,
                    url,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    contentLength: data.length,
                    hasManuscriptContent: false,
                    hasErrorMessages: false,
                    hasJsonData: false,
                    manifestUrl: null,
                    pageCount: null,
                    title: null,
                    observations: []
                };
                
                // Analyze response content
                if (data.includes('error') || data.includes('Error') || data.includes('ERROR')) {
                    result.hasErrorMessages = true;
                    result.observations.push('Contains error messages');
                }
                
                if (data.includes('manifest') || data.includes('IIIF')) {
                    result.hasJsonData = true;
                    // Try to extract manifest URL
                    const manifestMatch = data.match(/["']([^"']*manifest[^"']*)["']/i);
                    if (manifestMatch) {
                        result.manifestUrl = manifestMatch[1];
                    }
                }
                
                // Look for page indicators
                const pageMatch = data.match(/(\d+)\s*(?:pages?|pagine)/i);
                if (pageMatch) {
                    result.pageCount = parseInt(pageMatch[1]);
                }
                
                // Look for title
                const titleMatch = data.match(/<title[^>]*>([^<]+)</i);
                if (titleMatch) {
                    result.title = titleMatch[1].trim();
                }
                
                // Check for manuscript content indicators
                if (data.includes('manuscript') || data.includes('manoscritto') || 
                    data.includes('codice') || data.includes('volume') ||
                    data.includes('canvas') || data.includes('folio')) {
                    result.hasManuscriptContent = true;
                }
                
                // Check response size patterns
                if (data.length < 1000) {
                    result.observations.push('Very small response - likely error or redirect');
                } else if (data.length > 50000) {
                    result.observations.push('Large response - likely contains manuscript data');
                }
                
                // Check for specific Verona NBM patterns
                if (data.includes('nuovabibliotecamanoscritta')) {
                    result.observations.push('Contains NBM specific content');
                }
                
                if (data.includes('viewer') || data.includes('visualizza')) {
                    result.observations.push('Contains viewer interface');
                }
                
                // Look for JavaScript that might indicate successful loading
                if (data.includes('loadManifest') || data.includes('loadPages')) {
                    result.observations.push('Contains manuscript loading JavaScript');
                }
                
                console.log(`Status: ${result.statusCode}`);
                console.log(`Content Length: ${result.contentLength} bytes`);
                console.log(`Has Manuscript Content: ${result.hasManuscriptContent}`);
                console.log(`Has Errors: ${result.hasErrorMessages}`);
                console.log(`Observations: ${result.observations.join(', ')}`);
                
                // Save first response content for analysis
                if (codiceDigital === 15 && volume === 1) {
                    fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-sample-response.html', data);
                    console.log('Saved sample response content for analysis');
                }
                
                resolve(result);
            });
        });
        
        req.on('error', (err) => {
            console.log(`Error: ${err.message}`);
            resolve({
                codiceDigital,
                volume,
                description,
                url,
                error: err.message,
                statusCode: null,
                observations: ['Network error occurred']
            });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                codiceDigital,
                volume,
                description,
                url,
                error: 'Timeout',
                statusCode: null,
                observations: ['Request timeout']
            });
        });
    });
}

async function runAllTests() {
    console.log('Starting Verona NBM Parameter Testing');
    console.log('=====================================');
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testUrl(testCase.codiceDigital, testCase.volume, testCase.description);
        results.push(result);
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate summary report
    console.log('\n\nSUMMARY REPORT');
    console.log('==============');
    
    const successful = results.filter(r => r.statusCode === 200);
    const errors = results.filter(r => r.statusCode !== 200 || r.error);
    
    console.log(`Total tests: ${results.length}`);
    console.log(`Successful responses (200): ${successful.length}`);
    console.log(`Error responses: ${errors.length}`);
    
    console.log('\nSuccessful URLs:');
    successful.forEach(r => {
        console.log(`  - codiceDigital=${r.codiceDigital}, volume=${r.volume}: ${r.contentLength} bytes`);
    });
    
    console.log('\nError URLs:');
    errors.forEach(r => {
        console.log(`  - codiceDigital=${r.codiceDigital}, volume=${r.volume}: ${r.error || `Status ${r.statusCode}`}`);
    });
    
    // Save detailed results to file
    const reportData = {
        timestamp: new Date().toISOString(),
        baseUrl,
        testCases: results,
        summary: {
            total: results.length,
            successful: successful.length,
            errors: errors.length,
            successfulUrls: successful.map(r => ({ codiceDigital: r.codiceDigital, volume: r.volume, size: r.contentLength })),
            errorUrls: errors.map(r => ({ codiceDigital: r.codiceDigital, volume: r.volume, error: r.error || r.statusCode }))
        }
    };
    
    fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-test-results.json', JSON.stringify(reportData, null, 2));
    console.log('\nDetailed results saved to .devkit/verona-test-results.json');
    
    return results;
}

runAllTests().catch(console.error);