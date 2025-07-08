#!/usr/bin/env node

/**
 * CNMD Manuscript Discovery
 * 
 * This script investigates using the CNMD identifier to find
 * the complete manuscript rather than partial folios.
 */

const https = require('https');
const fs = require('fs').promises;

// From the manifest metadata
const cnmdId = 'CNMD\\0000016463';
const cnmsId = 'CNMS\\0000015597'; 
const cleanCnmdId = cnmdId.replace('CNMD\\', '');
const cleanCnmsId = cnmsId.replace('CNMS\\', '');

async function main() {
    console.log('🔍 CNMD Manuscript Discovery');
    console.log('=' .repeat(60));
    console.log(`📖 CNMD ID: ${cnmdId} (${cleanCnmdId})`);
    console.log(`📖 CNMS ID: ${cnmsId} (${cleanCnmsId})`);
    console.log('');

    try {
        // Step 1: Try ICCU Manus API (which handles CNMD IDs)
        console.log('🔄 Step 1: Testing ICCU Manus API with CNMD ID...');
        const manusUrls = [
            `https://manus.iccu.sbn.it/cnmd/${cleanCnmdId}`,
            `https://manus.iccu.sbn.it/ms?id=${cleanCnmdId}`,
            `https://manus.iccu.sbn.it/o/manus-api/title?id=${cleanCnmdId}`,
            `https://manus.iccu.sbn.it/cnms/${cleanCnmsId}`,
            `https://manus.iccu.sbn.it/ms?id=${cleanCnmsId}`,
            `https://manus.iccu.sbn.it/o/manus-api/title?id=${cleanCnmsId}`
        ];
        
        for (const url of manusUrls) {
            console.log(`   🌐 Testing: ${url}`);
            const result = await testEndpoint(url);
            if (result.success) {
                console.log(`   ✅ Found data (${result.size} bytes)`);
                await analyzeManusResponse(url, result.data);
            } else {
                console.log(`   ❌ ${result.error}`);
            }
        }
        
        // Step 2: Try Internet Culturale with CNMD ID
        console.log('');
        console.log('🔄 Step 2: Testing Internet Culturale with CNMD ID...');
        
        const internetCulturaleUrls = [
            `https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3A${cleanCnmdId}&mode=all&teca=Unknown`,
            `https://www.internetculturale.it/jmms/magparser?id=oai%3A${cleanCnmdId}&mode=all&fulltext=0`,
            `https://www.internetculturale.it/search?q=${cleanCnmdId}`,
            `https://www.internetculturale.it/jmms/magparser?id=${cleanCnmdId}&mode=all&fulltext=0`
        ];
        
        for (const url of internetCulturaleUrls) {
            console.log(`   🌐 Testing: ${url}`);
            const result = await testEndpoint(url);
            if (result.success) {
                console.log(`   ✅ Found data (${result.size} bytes)`);
                if (url.includes('magparser')) {
                    await analyzeInternetCulturaleXML(url, result.data);
                } else {
                    await analyzeInternetCulturaleHTML(url, result.data);
                }
            } else {
                console.log(`   ❌ ${result.error}`);
            }
        }
        
        // Step 3: Search for complete manuscript in DAM system
        console.log('');
        console.log('🔄 Step 3: Searching DAM system for complete manuscript...');
        
        // Try different approaches to find the complete manuscript
        const damSearchUrls = [
            `https://dam.iccu.sbn.it/search?q=${cleanCnmdId}`,
            `https://dam.iccu.sbn.it/mol_46/search?q=${cleanCnmdId}`,
            `https://dam.iccu.sbn.it/mol_46/search?segnatura=B%2050`,
            `https://dam.iccu.sbn.it/mol_46/collections`,
            `https://dam.iccu.sbn.it/mol_46/ms-b-50/manifest`,
            `https://dam.iccu.sbn.it/mol_46/vallicelliana-b-50/manifest`
        ];
        
        for (const url of damSearchUrls) {
            console.log(`   🌐 Testing: ${url}`);
            const result = await testEndpoint(url);
            if (result.success) {
                console.log(`   ✅ Found data (${result.size} bytes)`);
                await analyzeDAMResponse(url, result.data);
            } else {
                console.log(`   ❌ ${result.error}`);
            }
        }
        
        // Step 4: Generate fix strategy
        console.log('');
        console.log('📋 Fix Strategy:');
        console.log('   The metadata indicates this should be a 153-folio manuscript,');
        console.log('   but the current manifest only contains 2 folios.');
        console.log('');
        console.log('   Possible solutions:');
        console.log('   1. Use CNMD ID to find complete manuscript via Manus API');
        console.log('   2. Implement better manifest discovery for DAM system');
        console.log('   3. Warn user when manifest appears incomplete based on metadata');
        console.log('   4. Provide alternative URL suggestions');
        
        // Save detailed report
        const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/cnmd-discovery-report.json';
        const report = {
            timestamp: new Date().toISOString(),
            cnmdId,
            cnmsId,
            cleanCnmdId,
            cleanCnmsId,
            expectedFolios: 153,
            currentFolios: 2,
            testResults: {
                manusUrls: manusUrls.map(url => ({ url, tested: true })),
                internetCulturaleUrls: internetCulturaleUrls.map(url => ({ url, tested: true })),
                damSearchUrls: damSearchUrls.map(url => ({ url, tested: true }))
            },
            recommendations: [
                'Implement CNMD-based manuscript discovery',
                'Add metadata validation to detect incomplete manifests',
                'Provide alternative URL suggestions for complete manuscripts',
                'Enhance error messages with guidance for finding complete manuscripts'
            ]
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log('');
        console.log(`📄 Discovery report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Discovery failed:', error.message);
        console.error(error.stack);
    }
}

function testEndpoint(url) {
    return new Promise((resolve) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8'
            }
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`      ↳ Redirected to: ${res.headers.location}`);
                resolve(testEndpoint(res.headers.location));
                return;
            }
            
            if (res.statusCode !== 200) {
                resolve({
                    success: false,
                    error: `HTTP ${res.statusCode}`
                });
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    success: true,
                    size: data.length,
                    data
                });
            });
            res.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout'
            });
        });

        req.end();
    });
}

async function analyzeManusResponse(url, data) {
    console.log(`      📋 Manus API response analysis:`);
    
    if (data.includes('"status":"OK"') || data.includes('thumbnail')) {
        console.log(`         ✅ API response indicates manuscript found`);
        
        // Try to extract thumbnail/manifest URL
        const thumbnailMatch = data.match(/"src":"([^"]+)"/);
        if (thumbnailMatch) {
            const thumbnailUrl = thumbnailMatch[1];
            console.log(`         🖼️  Thumbnail URL: ${thumbnailUrl}`);
            
            // Convert to manifest URL
            const manifestUrl = thumbnailUrl.replace('/thumbnail', '/manifest');
            console.log(`         📄 Potential manifest URL: ${manifestUrl}`);
            
            // Test the manifest URL
            console.log(`         🔄 Testing manifest...`);
            const manifestResult = await testEndpoint(manifestUrl);
            if (manifestResult.success) {
                try {
                    const manifestData = JSON.parse(manifestResult.data);
                    const sequences = manifestData.sequences || (manifestData.items ? [{ canvases: manifestData.items }] : []);
                    let totalCanvases = 0;
                    for (const seq of sequences) {
                        totalCanvases += (seq.canvases || seq.items || []).length;
                    }
                    console.log(`         📊 Manifest contains ${totalCanvases} folios`);
                    
                    if (totalCanvases > 2) {
                        console.log(`         🎯 SOLUTION FOUND: Complete manuscript with ${totalCanvases} folios!`);
                    }
                } catch (parseError) {
                    console.log(`         ❌ Failed to parse manifest: ${parseError.message}`);
                }
            } else {
                console.log(`         ❌ Manifest not accessible: ${manifestResult.error}`);
            }
        }
    } else if (data.includes('404') || data.includes('Not Found')) {
        console.log(`         ❌ Manuscript not found in Manus system`);
    } else {
        console.log(`         📄 Response size: ${data.length} characters`);
        console.log(`         💭 Response preview: ${data.substring(0, 200)}...`);
    }
}

async function analyzeInternetCulturaleXML(url, data) {
    console.log(`      📋 Internet Culturale XML analysis:`);
    
    if (data.includes('<page') && data.includes('src=')) {
        const pageMatches = data.match(/<page[^>]+src="[^"]+"/g);
        if (pageMatches) {
            console.log(`         📊 Found ${pageMatches.length} pages in XML`);
            if (pageMatches.length > 2) {
                console.log(`         🎯 SOLUTION FOUND: Complete manuscript with ${pageMatches.length} pages!`);
            }
        }
    } else if (data.includes('error') || data.includes('not found')) {
        console.log(`         ❌ Error response or manuscript not found`);
    } else {
        console.log(`         📄 XML size: ${data.length} characters`);
        console.log(`         💭 XML preview: ${data.substring(0, 200)}...`);
    }
}

async function analyzeInternetCulturaleHTML(url, data) {
    console.log(`      📋 Internet Culturale HTML analysis:`);
    console.log(`         📄 Response size: ${data.length} characters`);
    
    if (data.includes('viewer') || data.includes('manifest')) {
        console.log(`         ✅ Viewer page found`);
    } else if (data.includes('search results') || data.includes('risultati')) {
        console.log(`         🔍 Search results page`);
    } else {
        console.log(`         💭 HTML preview: ${data.substring(0, 200)}...`);
    }
}

async function analyzeDAMResponse(url, data) {
    console.log(`      📋 DAM response analysis:`);
    
    try {
        const parsed = JSON.parse(data);
        console.log(`         📋 JSON response:`);
        console.log(`            Type: ${parsed['@type'] || parsed.type || 'Unknown'}`);
        
        if (parsed.items && Array.isArray(parsed.items)) {
            console.log(`            Items: ${parsed.items.length}`);
        }
        
        if (parsed.sequences && Array.isArray(parsed.sequences)) {
            let totalCanvases = 0;
            for (const seq of parsed.sequences) {
                totalCanvases += (seq.canvases || []).length;
            }
            console.log(`            Total canvases: ${totalCanvases}`);
            
            if (totalCanvases > 2) {
                console.log(`         🎯 SOLUTION FOUND: Complete manuscript with ${totalCanvases} folios!`);
            }
        }
    } catch (parseError) {
        console.log(`         📄 Non-JSON response size: ${data.length} characters`);
        console.log(`         💭 Response preview: ${data.substring(0, 200)}...`);
    }
}

// Run the discovery
main().catch(console.error);