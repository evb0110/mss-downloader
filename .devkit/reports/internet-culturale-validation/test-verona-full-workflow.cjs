#!/usr/bin/env node

console.log('🔧 Testing Verona Full Workflow');
console.log('Testing the complete Verona manuscript loading process');

const https = require('https');
const { URL } = require('url');

// Simulate the full fetchWithHTTPS method with library optimizations
function fetchWithHTTPS(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            rejectUnauthorized: false
        };
        
        const startTime = Date.now();
        
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const body = Buffer.concat(chunks);
                const response = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    json: () => Promise.resolve(JSON.parse(body.toString())),
                    text: () => Promise.resolve(body.toString()),
                    duration: duration
                };
                
                resolve(response);
            });
        });
        
        req.on('error', (error) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            error.duration = duration;
            reject(error);
        });
        
        // Apply Verona-optimized timeout: 30000ms * 1.5 = 45000ms
        const baseTimeout = 30000;
        const veronaMultiplier = 1.5;
        const optimizedTimeout = Math.floor(baseTimeout * veronaMultiplier);
        const timeoutMs = options.timeout || optimizedTimeout;
        
        req.setTimeout(timeoutMs, () => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            req.destroy();
            const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
            timeoutError.duration = duration;
            reject(timeoutError);
        });
        
        req.end();
    });
}

// Simulate the loadVeronaManifest logic
async function loadVeronaManifest(originalUrl) {
    console.log(`\n🔄 Loading Verona manifest for: ${originalUrl}`);
    
    let manifestUrl;
    let displayName;
    
    if (originalUrl.includes('nbm.regione.veneto.it') && originalUrl.includes('/manifest/')) {
        // Direct manifest URL
        manifestUrl = originalUrl;
        const manifestMatch = originalUrl.match(/manifest\/([^.]+)\.json/);
        displayName = `Verona_NBM_${manifestMatch?.[1] || 'unknown'}`;
        
    } else if (originalUrl.includes('nuovabibliotecamanoscritta.it')) {
        // Need to extract manifest URL from viewer page
        let codiceDigital;
        
        if (originalUrl.includes('codice=')) {
            const codiceMatch = originalUrl.match(/codice=(\d+)/);
            codiceDigital = codiceMatch?.[1];
        } else if (originalUrl.includes('codiceDigital=')) {
            const codiceDigitalMatch = originalUrl.match(/codiceDigital=(\d+)/);
            codiceDigital = codiceDigitalMatch?.[1];
        }
        
        if (!codiceDigital) {
            throw new Error('Cannot extract codiceDigital from Verona URL');
        }
        
        console.log(`   📋 Extracted codice: ${codiceDigital}`);
        
        // Known mapping patterns from research
        const manifestMappings = {
            '14': 'CVII1001',
            '15': 'LXXXIX841',
            '12': 'CXLV1331',
            '17': 'msClasseIII81'
        };
        
        const manifestId = manifestMappings[codiceDigital];
        if (!manifestId) {
            throw new Error(`Unknown Verona codiceDigital: ${codiceDigital}. Manual manifest URL required.`);
        }
        
        console.log(`   🔗 Mapped to manifest ID: ${manifestId}`);
        
        manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifestId}.json`;
        displayName = `Verona_NBM_${manifestId}`;
        
    } else {
        throw new Error('Unsupported Verona URL format - must be NBM manifest or catalog URL');
    }
    
    console.log(`   📡 Fetching manifest: ${manifestUrl}`);
    
    // Fetch and parse IIIF manifest with optimized timeout
    const response = await fetchWithHTTPS(manifestUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
    }
    
    console.log(`   ✅ Manifest fetched successfully in ${response.duration}ms`);
    
    const manifestData = await response.json();
    
    // Validate IIIF manifest structure
    if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
        throw new Error('Invalid IIIF manifest structure');
    }
    
    // Extract page URLs
    const pageLinks = manifestData.sequences[0].canvases.map((canvas) => {
        const resource = canvas.images[0].resource;
        if (resource.service && resource.service['@id']) {
            // Use maximum resolution IIIF Image API construction
            const serviceId = resource.service['@id'].replace(/\/$/, '');
            return `${serviceId}/full/20000,/0/default.jpg`;
        } else if (resource['@id']) {
            // Fallback to direct resource URL
            return resource['@id'];
        }
        return null;
    }).filter((link) => link);
    
    if (pageLinks.length === 0) {
        throw new Error('No pages found in manifest');
    }
    
    console.log(`   📄 Successfully extracted ${pageLinks.length} pages`);
    console.log(`   🏷️  Display name: ${displayName}`);
    
    return {
        pageLinks,
        totalPages: pageLinks.length,
        library: 'verona',
        displayName: displayName,
        originalUrl: originalUrl,
    };
}

async function testVeronaWorkflow() {
    console.log('\n📋 Testing Verona library workflow with timeout fix');
    
    const testUrls = [
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=14',
        'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json'
    ];
    
    let successCount = 0;
    let totalTests = testUrls.length;
    
    for (let i = 0; i < testUrls.length; i++) {
        const testUrl = testUrls[i];
        console.log(`\n🔧 Test ${i + 1}/${totalTests}: Testing ${testUrl}`);
        
        try {
            const manifest = await loadVeronaManifest(testUrl);
            
            console.log(`✅ Test ${i + 1} PASSED`);
            console.log(`   📄 Pages: ${manifest.totalPages}`);
            console.log(`   🏷️  Name: ${manifest.displayName}`);
            console.log(`   📚 Library: ${manifest.library}`);
            
            // Validate manifest structure
            if (manifest.totalPages > 0 && manifest.pageLinks.length > 0) {
                console.log(`   ✅ Manifest structure valid`);
                successCount++;
            } else {
                console.log(`   ⚠️  Manifest structure invalid (no pages)`);
            }
            
        } catch (error) {
            console.log(`❌ Test ${i + 1} FAILED: ${error.message}`);
            
            // Analyze error type
            if (error.message.includes('timeout')) {
                console.log('   🔍 Timeout error - may need further timeout adjustment');
            } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
                console.log('   🔍 SSL error - certificate bypass may need improvement');
            } else if (error.message.includes('fetch failed')) {
                console.log('   🔍 Network error - may be connectivity issue');
            } else {
                console.log('   🔍 Other error - check manifest structure or URL mapping');
            }
        }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Successful: ${successCount}/${totalTests}`);
    console.log(`   ❌ Failed: ${totalTests - successCount}/${totalTests}`);
    console.log(`   📈 Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
    
    if (successCount === totalTests) {
        console.log('\n🎉 All Verona workflow tests PASSED!');
        console.log('✅ SSL certificate bypass working');
        console.log('✅ Optimized timeout (45s) applied');
        console.log('✅ Manifest loading working');
        console.log('✅ Page extraction working');
        return true;
    } else {
        console.log('\n💥 Some Verona workflow tests FAILED!');
        return false;
    }
}

// Run the workflow test
testVeronaWorkflow()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n💥 Test execution failed:', error);
        process.exit(1);
    });