const https = require('https');
const fs = require('fs');

// Disable SSL verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const testCases = [
    // Test different codiceDigital and volume combinations with working URL pattern
    { codiceDigital: 15, volume: 1, description: 'Original working parameters' },
    { codiceDigital: 15, volume: 2, description: 'Same codice, volume 2' },
    { codiceDigital: 15, volume: 3, description: 'Same codice, volume 3' },
    { codiceDigital: 15, volume: 0, description: 'Volume 0 test' },
    { codiceDigital: 15, volume: 10, description: 'High volume test' },
    
    { codiceDigital: 14, volume: 1, description: 'codice 14, volume 1' },
    { codiceDigital: 14, volume: 2, description: 'codice 14, volume 2' },
    
    { codiceDigital: 16, volume: 1, description: 'codice 16, volume 1' },
    { codiceDigital: 16, volume: 2, description: 'codice 16, volume 2' },
    
    { codiceDigital: 1, volume: 1, description: 'First codice, volume 1' },
    { codiceDigital: 1, volume: 2, description: 'First codice, volume 2' },
    
    { codiceDigital: 100, volume: 1, description: 'High codice, volume 1' },
    { codiceDigital: 50, volume: 1, description: 'Mid-range codice, volume 1' },
    
    // Test edge cases
    { codiceDigital: 999, volume: 1, description: 'Very high codice test' },
    { codiceDigital: 15, volume: 99, description: 'Very high volume test' },
];

async function testParameters(codiceDigital, volume, description) {
    return new Promise((resolve) => {
        const url = `https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=${codiceDigital}&volume=${volume}`;
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
                    manifestUrl: null,
                    title: null,
                    observations: []
                };
                
                // Analyze response content for manuscript data
                if (result.isSuccess) {
                    // Look for manuscript title
                    const titleMatch = data.match(/<title[^>]*>([^<]+)</i) || 
                                     data.match(/data-title="([^"]+)"/i) ||
                                     data.match(/title["']\\s*:\\s*["']([^"']+)["']/i);
                    if (titleMatch) {
                        result.title = titleMatch[1].trim();
                    }
                    
                    // Look for manifest URL or IIIF references
                    const manifestMatch = data.match(/manifest[^"']*["']([^"']+manifest[^"']*\.json)/i) ||
                                        data.match(/["']([^"']*nbm\.regione\.veneto\.it[^"']*manifest[^"']*\.json)/i);
                    if (manifestMatch) {
                        result.manifestUrl = manifestMatch[1];
                        result.observations.push('Contains IIIF manifest URL');
                    }
                    
                    // Look for manuscript content indicators
                    if (data.includes('canvas') || data.includes('folio') || data.includes('pagina')) {
                        result.observations.push('Contains page/canvas references');
                    }
                    
                    if (data.includes('viewer') || data.includes('visualizza') || data.includes('mirador')) {
                        result.observations.push('Contains viewer interface');
                    }
                    
                    if (data.includes('manoscritto') || data.includes('codice') || data.includes('manuscript')) {
                        result.observations.push('Contains manuscript metadata');
                    }
                    
                    // Check for error content within successful response
                    if (data.includes('errore') || data.includes('error') || 
                        data.includes('non trovato') || data.includes('not found') ||
                        data.includes('non disponibile') || data.includes('not available')) {
                        result.observations.push('⚠️  Contains error messages');
                    }
                    
                    // Check for empty or minimal content
                    if (data.length < 1000) {
                        result.observations.push('⚠️  Very small response - may be empty');
                    }
                    
                } else {
                    result.observations.push(`❌ HTTP ${res.statusCode} error`);
                }
                
                // Output results
                console.log(`   Status: ${result.statusCode} ${result.isSuccess ? '✅' : '❌'}`);
                console.log(`   Size: ${result.contentLength} bytes`);
                if (result.title) {
                    console.log(`   Title: "${result.title}"`);
                }
                if (result.manifestUrl) {
                    console.log(`   Manifest: ${result.manifestUrl}`);
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

async function runParameterTests() {
    console.log('🔬 VERONA NBM PARAMETER ANALYSIS');
    console.log('=================================');
    console.log('Testing different codiceDigital and volume parameter combinations');
    console.log('with the working URL pattern: /VisualizzaVolume/visualizza.html\n');
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testParameters(testCase.codiceDigital, testCase.volume, testCase.description);
        results.push(result);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Generate comprehensive analysis
    console.log('\n\n📊 PARAMETER ANALYSIS RESULTS');
    console.log('==============================');
    
    const successful = results.filter(r => r.isSuccess);
    const failed = results.filter(r => !r.isSuccess);
    const withManifests = results.filter(r => r.manifestUrl);
    const withErrors = results.filter(r => r.observations.some(obs => obs.includes('error')));
    
    console.log(`✅ Successful responses: ${successful.length}/${results.length}`);
    console.log(`🔗 Responses with manifest URLs: ${withManifests.length}`);
    console.log(`⚠️  Responses with error content: ${withErrors.length}`);
    console.log(`❌ Failed responses: ${failed.length}`);
    
    // Analyze parameter patterns
    console.log('\n🔍 PARAMETER PATTERN ANALYSIS');
    console.log('─────────────────────────────');
    
    // Group by codiceDigital
    const byCodice = {};
    results.forEach(r => {
        if (!byCodice[r.codiceDigital]) byCodice[r.codiceDigital] = [];
        byCodice[r.codiceDigital].push(r);
    });
    
    console.log('\n📋 Results by Codice Digital:');
    Object.keys(byCodice).sort((a, b) => parseInt(a) - parseInt(b)).forEach(codice => {
        const codiceResults = byCodice[codice];
        const successCount = codiceResults.filter(r => r.isSuccess).length;
        const manifestCount = codiceResults.filter(r => r.manifestUrl).length;
        
        console.log(`\n  📖 Codice ${codice}: ${successCount}/${codiceResults.length} successful, ${manifestCount} with manifests`);
        codiceResults.forEach(r => {
            const status = r.isSuccess ? '✅' : '❌';
            const manifest = r.manifestUrl ? '🔗' : '  ';
            const size = r.contentLength ? `${r.contentLength}b` : 'N/A';
            console.log(`     ${status} ${manifest} Volume ${r.volume}: ${size} - ${r.title || 'No title'}`);
        });
    });
    
    // Analyze volume patterns
    console.log('\n📊 Volume Pattern Analysis:');
    const volumeStats = {};
    results.forEach(r => {
        if (!volumeStats[r.volume]) volumeStats[r.volume] = { total: 0, successful: 0, withManifest: 0 };
        volumeStats[r.volume].total++;
        if (r.isSuccess) volumeStats[r.volume].successful++;
        if (r.manifestUrl) volumeStats[r.volume].withManifest++;
    });
    
    Object.keys(volumeStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(volume => {
        const stats = volumeStats[volume];
        console.log(`  Volume ${volume}: ${stats.successful}/${stats.total} successful, ${stats.withManifest} with manifests`);
    });
    
    // Show manuscripts with manifest URLs
    if (withManifests.length > 0) {
        console.log('\n🔗 MANUSCRIPTS WITH IIIF MANIFESTS:');
        console.log('──────────────────────────────────');
        withManifests.forEach(r => {
            console.log(`\n  📖 Codice ${r.codiceDigital}, Volume ${r.volume}`);
            console.log(`     Title: ${r.title || 'Unknown'}`);
            console.log(`     Manifest: ${r.manifestUrl}`);
            console.log(`     Size: ${r.contentLength} bytes`);
        });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS FOR MANUSCRIPT DOWNLOADER:');
    console.log('─────────────────────────────────────────────');
    
    const workingCodices = [...new Set(successful.map(r => r.codiceDigital))];
    const workingVolumes = [...new Set(successful.map(r => r.volume))];
    
    console.log(`✓ Working Codice Digital values: ${workingCodices.sort((a, b) => a - b).join(', ')}`);
    console.log(`✓ Working Volume values: ${workingVolumes.sort((a, b) => a - b).join(', ')}`);
    console.log(`✓ URL Pattern: https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=X&volume=Y`);
    
    if (withManifests.length > 0) {
        console.log(`✓ IIIF manifest discovery: ${withManifests.length} manuscripts provide direct manifest URLs`);
    }
    
    // Save detailed results
    const reportData = {
        timestamp: new Date().toISOString(),
        testPattern: 'https://www.nuovabibliotecamanoscritta.it/VisualizzaVolume/visualizza.html?codiceDigital=X&volume=Y',
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            withManifests: withManifests.length,
            withErrors: withErrors.length
        },
        parameterAnalysis: {
            workingCodices,
            workingVolumes,
            codiceStats: byCodice,
            volumeStats
        },
        results,
        manifestUrls: withManifests.map(r => ({
            codiceDigital: r.codiceDigital,
            volume: r.volume,
            title: r.title,
            manifestUrl: r.manifestUrl
        }))
    };
    
    fs.writeFileSync('/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-parameter-analysis.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Detailed results saved to .devkit/verona-parameter-analysis.json');
    
    return results;
}

runParameterTests().catch(console.error);