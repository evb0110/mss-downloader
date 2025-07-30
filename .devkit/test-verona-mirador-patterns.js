const https = require('https');
const fs = require('fs');

// Disable SSL verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Test the mirador.html URLs to find manifest patterns
const testCases = [
    { codiceDigital: 14, volume: 1, description: 'codice 14, volume 1' },
    { codiceDigital: 15, volume: 1, description: 'codice 15, volume 1' },
    { codiceDigital: 15, volume: 2, description: 'codice 15, volume 2' },
    { codiceDigital: 16, volume: 1, description: 'codice 16, volume 1' },
    { codiceDigital: 16, volume: 2, description: 'codice 16, volume 2' },
];

async function testMiradorUrl(codiceDigital, volume, description) {
    return new Promise((resolve) => {
        const url = `https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/mirador.html?codiceDigital=${codiceDigital}&volume=${volume}`;
        console.log(`\n🔍 Testing: ${description}`);
        console.log(`   URL: ${url}`);
        
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
                    contentLength: data.length,
                    isSuccess: res.statusCode === 200,
                    manifestData: null,
                    manifestUrl: null,
                    title: null,
                    location: null,
                    fullManifestUrl: null,
                    observations: []
                };
                
                if (result.isSuccess) {
                    // Extract the manifest data from JavaScript
                    const dataMatch = data.match(/var\s+data\s*=\s*(\[.*?\]);/s);
                    if (dataMatch) {
                        try {
                            const manifestData = JSON.parse(dataMatch[1]);
                            result.manifestData = manifestData;
                            
                            if (manifestData.length > 0) {
                                const firstManifest = manifestData[0];
                                result.location = firstManifest.location;
                                result.title = firstManifest.title;
                                result.manifestUrl = firstManifest.manifestUri;
                                
                                // Construct full manifest URL
                                if (result.manifestUrl) {
                                    if (result.manifestUrl.startsWith('documenti/')) {
                                        result.fullManifestUrl = `https://nbm.regione.veneto.it/${result.manifestUrl}`;
                                    } else {
                                        result.fullManifestUrl = result.manifestUrl;
                                    }
                                }
                                
                                result.observations.push(`Found ${manifestData.length} manifest(s)`);
                                result.observations.push('Contains valid manifest data');
                            }
                        } catch (e) {
                            result.observations.push('⚠️  Invalid manifest JSON');
                        }
                    } else {
                        result.observations.push('⚠️  No manifest data found');
                    }
                    
                    // Check for errors
                    if (data.includes('errore') || data.includes('error')) {
                        result.observations.push('⚠️  Contains error messages');
                    }
                } else {
                    result.observations.push(`❌ HTTP ${res.statusCode} error`);
                }
                
                // Output results
                console.log(`   Status: ${result.statusCode} ${result.isSuccess ? '✅' : '❌'}`);
                console.log(`   Size: ${result.contentLength} bytes`);
                if (result.location) {
                    console.log(`   Location: ${result.location}`);
                }
                if (result.title) {
                    console.log(`   Title: "${result.title}"`);
                }
                if (result.manifestUrl) {
                    console.log(`   Manifest: ${result.manifestUrl}`);
                }
                if (result.fullManifestUrl) {
                    console.log(`   Full URL: ${result.fullManifestUrl}`);
                }
                if (result.observations.length > 0) {
                    console.log(`   Features: ${result.observations.join(', ')}`);
                }
                
                resolve(result);
            });
        });
        
        req.on('error', (err) => {
            console.log(`   ❌ Error: ${err.message}`);
            resolve({
                codiceDigital,
                volume,
                description,
                url,
                error: err.message,
                statusCode: null,
                isSuccess: false,
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
                isSuccess: false,
                observations: ['Request timeout']
            });
        });
    });
}

async function testManifestUrl(manifestUrl) {
    return new Promise((resolve) => {
        console.log(`\n🔗 Testing manifest: ${manifestUrl}`);
        
        const req = https.get(manifestUrl, {
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
                    url: manifestUrl,
                    statusCode: res.statusCode,
                    contentLength: data.length,
                    isSuccess: res.statusCode === 200,
                    isValidIIIF: false,
                    pageCount: 0,
                    observations: []
                };
                
                if (result.isSuccess) {
                    try {
                        const manifest = JSON.parse(data);
                        
                        // Check if it's a valid IIIF manifest
                        if (manifest['@context'] && manifest.sequences) {
                            result.isValidIIIF = true;
                            
                            // Count pages/canvases
                            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                                result.pageCount = manifest.sequences[0].canvases.length;
                            }
                            
                            result.observations.push('Valid IIIF manifest');
                            result.observations.push(`${result.pageCount} pages/canvases`);
                            
                            if (manifest.label) {
                                result.observations.push(`Label: "${manifest.label}"`);
                            }
                        } else {
                            result.observations.push('⚠️  Not a valid IIIF manifest');
                        }
                    } catch (e) {
                        result.observations.push('⚠️  Invalid JSON');
                    }
                } else {
                    result.observations.push(`❌ HTTP ${res.statusCode} error`);
                }
                
                console.log(`   Manifest Status: ${result.statusCode} ${result.isSuccess ? '✅' : '❌'}`);
                console.log(`   Size: ${result.contentLength} bytes`);
                console.log(`   Valid IIIF: ${result.isValidIIIF ? '✅' : '❌'}`);
                if (result.pageCount > 0) {
                    console.log(`   Pages: ${result.pageCount}`);
                }
                
                resolve(result);
            });
        });
        
        req.on('error', (err) => {
            console.log(`   ❌ Manifest Error: ${err.message}`);
            resolve({
                url: manifestUrl,
                error: err.message,
                statusCode: null,
                isSuccess: false,
                observations: ['Network error occurred']
            });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                url: manifestUrl,
                error: 'Timeout',
                statusCode: null,
                isSuccess: false,
                observations: ['Request timeout']
            });
        });
    });
}

async function runMiradorTests() {
    console.log('🎭 VERONA MIRADOR MANIFEST ANALYSIS');
    console.log('===================================');
    console.log('Testing mirador.html URLs to extract IIIF manifest patterns\n');
    
    const results = [];
    const manifestTests = [];
    
    // Test mirador URLs
    for (const testCase of testCases) {
        const result = await testMiradorUrl(testCase.codiceDigital, testCase.volume, testCase.description);
        results.push(result);
        
        // If we found a manifest URL, test it
        if (result.fullManifestUrl && result.isSuccess) {
            const manifestResult = await testManifestUrl(result.fullManifestUrl);
            manifestTests.push({
                ...manifestResult,
                codiceDigital: result.codiceDigital,
                volume: result.volume,
                sourceTitle: result.title
            });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Analysis
    console.log('\n\n📊 MIRADOR ANALYSIS RESULTS');
    console.log('============================');
    
    const successful = results.filter(r => r.isSuccess);
    const withManifests = results.filter(r => r.manifestUrl);
    const validManifests = manifestTests.filter(m => m.isValidIIIF);
    
    console.log(`✅ Successful mirador responses: ${successful.length}/${results.length}`);
    console.log(`🔗 Responses with manifest URLs: ${withManifests.length}`);  
    console.log(`📋 Valid IIIF manifests: ${validManifests.length}`);
    
    if (withManifests.length > 0) {
        console.log('\n🔗 DISCOVERED MANIFESTS:');
        console.log('────────────────────────');
        withManifests.forEach(r => {
            console.log(`\n  📖 Codice ${r.codiceDigital}, Volume ${r.volume}`);
            console.log(`     Title: ${r.title || 'Unknown'}`);
            console.log(`     Manifest: ${r.manifestUrl}`);
            console.log(`     Full URL: ${r.fullManifestUrl}`);
            
            // Find corresponding manifest test result
            const manifestTest = manifestTests.find(m => 
                m.codiceDigital === r.codiceDigital && m.volume === r.volume
            );
            if (manifestTest) {
                console.log(`     IIIF Valid: ${manifestTest.isValidIIIF ? '✅' : '❌'}`);
                if (manifestTest.pageCount > 0) {
                    console.log(`     Pages: ${manifestTest.pageCount}`);
                }
            }
        });
    }
    
    // Pattern analysis
    console.log('\n🔍 URL PATTERN ANALYSIS:');
    console.log('─────────────────────────');
    
    const manifestIds = withManifests.map(r => {
        const match = r.manifestUrl.match(/manifest\/(.*?)\.json/);
        return match ? match[1] : null;
    }).filter(Boolean);
    
    console.log(`✓ Mirador URL Pattern: https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/mirador.html?codiceDigital=X&volume=Y`);
    console.log(`✓ Manifest URL Pattern: https://nbm.regione.veneto.it/documenti/mirador_json/manifest/ID.json`);
    console.log(`✓ Discovered Manifest IDs: ${manifestIds.join(', ')}`);
    
    // Mapping analysis
    console.log('\n📋 PARAMETER MAPPING:');
    console.log('─────────────────────');
    withManifests.forEach(r => {
        const manifestId = r.manifestUrl.match(/manifest\/(.*?)\.json/)?.[1];
        console.log(`  Codice ${r.codiceDigital}, Volume ${r.volume} → Manifest ID: ${manifestId}`);
    });
    
    // Save comprehensive results
    const reportData = {
        timestamp: new Date().toISOString(),
        miradorPattern: 'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/mirador.html?codiceDigital=X&volume=Y',
        manifestPattern: 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/ID.json',
        summary: {
            totalTests: results.length,
            successfulMirador: successful.length,
            withManifests: withManifests.length,
            validManifests: validManifests.length
        },
        parameterMapping: withManifests.map(r => ({
            codiceDigital: r.codiceDigital,
            volume: r.volume,
            title: r.title,
            manifestUrl: r.manifestUrl,
            fullManifestUrl: r.fullManifestUrl,
            manifestId: r.manifestUrl.match(/manifest\/(.*?)\.json/)?.[1]
        })),
        miradorResults: results,
        manifestResults: manifestTests
    };
    
    fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-mirador-analysis.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Detailed results saved to .devkit/verona-mirador-analysis.json');
    
    return { results, manifestTests };
}

runMiradorTests().catch(console.error);