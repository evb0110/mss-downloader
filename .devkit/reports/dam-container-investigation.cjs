#!/usr/bin/env node

/**
 * DAM Container Investigation
 * 
 * This script investigates the DAM (Digitization and Archive Management) system
 * to understand if we can discover the complete manuscript structure.
 */

const https = require('https');
const fs = require('fs').promises;

// Original URL from the user
const containerUrl = 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest';
const containerId = 'avQYk0e';
const baseUrl = 'https://dam.iccu.sbn.it/mol_46';

async function main() {
    console.log('🔍 DAM Container Investigation');
    console.log('=' .repeat(60));
    console.log(`📖 Container ID: ${containerId}`);
    console.log(`🌐 Base URL: ${baseUrl}`);
    console.log('');

    try {
        // Step 1: Try to find collection or parent structure
        console.log('🔄 Step 1: Investigating DAM API endpoints...');
        
        const endpoints = [
            `${baseUrl}/collection.json`,
            `${baseUrl}/containers.json`,
            `${baseUrl}/collections.json`,
            `${baseUrl}/manifest.json`,
            `${baseUrl}/index.json`,
            `${baseUrl}/containers/${containerId}`,
            `${baseUrl}/containers/${containerId}.json`,
            `${baseUrl}/containers/${containerId}/info`,
            `${baseUrl}/containers/${containerId}/collection`,
            `${baseUrl}/containers/${containerId}/parent`
        ];
        
        for (const endpoint of endpoints) {
            console.log(`   🌐 Testing: ${endpoint}`);
            const result = await testEndpoint(endpoint);
            if (result.success) {
                console.log(`   ✅ Found data (${result.size} bytes)`);
                await analyzeEndpointData(endpoint, result.data);
            } else {
                console.log(`   ❌ ${result.error}`);
            }
        }
        
        // Step 2: Try to discover related containers
        console.log('');
        console.log('🔄 Step 2: Looking for related containers...');
        
        // Try incrementing/decrementing the container ID
        const baseContainerId = containerId;
        const variations = generateContainerVariations(baseContainerId);
        
        console.log(`   🔍 Testing ${variations.length} container variations...`);
        const relatedContainers = [];
        
        for (const varId of variations.slice(0, 10)) { // Limit to first 10 to avoid spam
            const varUrl = `${baseUrl}/containers/${varId}/manifest`;
            console.log(`   Testing: ${varId}`);
            const result = await testEndpoint(varUrl);
            if (result.success) {
                relatedContainers.push({
                    id: varId,
                    url: varUrl,
                    size: result.size
                });
                console.log(`   ✅ Found: ${varId} (${result.size} bytes)`);
            }
        }
        
        // Step 3: Analyze original manifest for clues
        console.log('');
        console.log('🔄 Step 3: Analyzing original manifest for collection clues...');
        
        const originalManifest = await fetchJson(containerUrl);
        const clues = extractCollectionClues(originalManifest);
        
        console.log(`📋 Collection Clues Found:`);
        clues.forEach(clue => {
            console.log(`   • ${clue}`);
        });
        
        // Step 4: Try to find the collection manifest
        console.log('');
        console.log('🔄 Step 4: Searching for collection manifests...');
        
        if (originalManifest.partOf || originalManifest.within) {
            const parentRef = originalManifest.partOf || originalManifest.within;
            console.log(`   🔗 Found parent reference: ${JSON.stringify(parentRef)}`);
            
            if (typeof parentRef === 'string') {
                console.log(`   🌐 Testing parent manifest: ${parentRef}`);
                const parentResult = await testEndpoint(parentRef);
                if (parentResult.success) {
                    await analyzeParentManifest(parentRef, parentResult.data);
                }
            } else if (Array.isArray(parentRef)) {
                for (const ref of parentRef) {
                    if (ref.id || ref['@id']) {
                        const refUrl = ref.id || ref['@id'];
                        console.log(`   🌐 Testing parent manifest: ${refUrl}`);
                        const parentResult = await testEndpoint(refUrl);
                        if (parentResult.success) {
                            await analyzeParentManifest(refUrl, parentResult.data);
                        }
                    }
                }
            }
        } else {
            console.log('   ❌ No parent references found in manifest');
        }
        
        // Step 5: Generate recommendations
        console.log('');
        console.log('📋 Recommendations:');
        
        if (relatedContainers.length > 1) {
            console.log(`   ✅ Found ${relatedContainers.length} related containers`);
            console.log('   💡 This suggests the manuscript is split across multiple containers');
            console.log('   💡 Implementation should aggregate all related containers');
        } else {
            console.log('   ❌ No related containers found with similar IDs');
            console.log('   💡 This manifest may truly contain only 2 folios');
        }
        
        // Write investigation report
        const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/dam-investigation-report.json';
        const report = {
            timestamp: new Date().toISOString(),
            containerId,
            originalUrl: containerUrl,
            endpointTests: endpoints.map(ep => ({ endpoint: ep, tested: true })),
            relatedContainers,
            collectionClues: clues,
            originalManifest,
            recommendations: generateDetailedRecommendations(relatedContainers, clues)
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log('');
        console.log(`📄 Investigation report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Investigation failed:', error.message);
        console.error(error.stack);
    }
}

function testEndpoint(url) {
    return new Promise((resolve) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json,application/ld+json,*/*'
            }
        }, (res) => {
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

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout'
            });
        });

        req.end();
    });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json,application/ld+json,*/*'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON: ${parseError.message}`));
                }
            });
            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

function generateContainerVariations(baseId) {
    const variations = [];
    
    // Extract pattern: avQYk0e
    // Try incrementing the last character
    const baseChars = baseId.split('');
    
    // Try different endings
    for (let i = 0; i < 26; i++) {
        const lastChar = String.fromCharCode(97 + i); // a-z
        const variation = baseChars.slice(0, -1).join('') + lastChar;
        if (variation !== baseId) {
            variations.push(variation);
        }
    }
    
    // Try incrementing other characters
    for (let pos = baseChars.length - 2; pos >= 0; pos--) {
        const char = baseChars[pos];
        if (char.match(/[a-zA-Z]/)) {
            const code = char.charCodeAt(0);
            const nextChar = String.fromCharCode(code + 1);
            const variation = baseChars.slice(0, pos).join('') + nextChar + baseChars.slice(pos + 1).join('');
            variations.push(variation);
        }
    }
    
    return variations.slice(0, 20); // Limit variations
}

function extractCollectionClues(manifest) {
    const clues = [];
    
    if (manifest.label) {
        clues.push(`Title: ${JSON.stringify(manifest.label)}`);
    }
    
    if (manifest.metadata) {
        manifest.metadata.forEach(meta => {
            if (meta.label && meta.value) {
                clues.push(`Metadata: ${JSON.stringify(meta.label)} = ${JSON.stringify(meta.value)}`);
            }
        });
    }
    
    if (manifest['@context']) {
        clues.push(`Context: ${manifest['@context']}`);
    }
    
    if (manifest.attribution) {
        clues.push(`Attribution: ${JSON.stringify(manifest.attribution)}`);
    }
    
    return clues;
}

async function analyzeEndpointData(endpoint, data) {
    try {
        const parsed = JSON.parse(data);
        console.log(`      📋 JSON data found:`);
        console.log(`         Type: ${parsed['@type'] || parsed.type || 'Unknown'}`);
        if (parsed.label) {
            console.log(`         Label: ${JSON.stringify(parsed.label)}`);
        }
        if (parsed.items && Array.isArray(parsed.items)) {
            console.log(`         Items: ${parsed.items.length}`);
        }
        if (parsed.manifests && Array.isArray(parsed.manifests)) {
            console.log(`         Manifests: ${parsed.manifests.length}`);
        }
    } catch (parseError) {
        console.log(`      📄 Raw data (${data.length} chars)`);
    }
}

async function analyzeParentManifest(url, data) {
    try {
        const parsed = JSON.parse(data);
        console.log(`   📋 Parent manifest analysis:`);
        console.log(`      Type: ${parsed['@type'] || parsed.type || 'Unknown'}`);
        
        if (parsed.items && Array.isArray(parsed.items)) {
            console.log(`      Contains ${parsed.items.length} items`);
            parsed.items.forEach((item, i) => {
                if (item.id && item.label) {
                    console.log(`         ${i + 1}. ${item.id} - ${JSON.stringify(item.label)}`);
                }
            });
        }
        
        if (parsed.manifests && Array.isArray(parsed.manifests)) {
            console.log(`      Contains ${parsed.manifests.length} manifests`);
            parsed.manifests.forEach((manifest, i) => {
                if (manifest.id && manifest.label) {
                    console.log(`         ${i + 1}. ${manifest.id} - ${JSON.stringify(manifest.label)}`);
                }
            });
        }
    } catch (parseError) {
        console.log(`   ❌ Failed to parse parent manifest: ${parseError.message}`);
    }
}

function generateDetailedRecommendations(relatedContainers, clues) {
    const recommendations = [];
    
    if (relatedContainers.length > 1) {
        recommendations.push({
            type: 'fix',
            priority: 'high',
            description: 'Implement container aggregation to combine multiple related containers into a single manuscript',
            implementation: 'Modify loadVallicellianManifest to detect and aggregate related containers'
        });
    }
    
    if (clues.length > 0) {
        recommendations.push({
            type: 'enhancement',
            priority: 'medium',
            description: 'Use metadata clues to provide better error messages and user guidance',
            implementation: 'Parse manuscript metadata to explain when a manifest contains partial content'
        });
    }
    
    recommendations.push({
        type: 'validation',
        priority: 'high',
        description: 'Add validation to detect single-folio manifests and guide users to complete manuscripts',
        implementation: 'Warn users when manifest contains fewer than expected pages based on metadata'
    });
    
    return recommendations;
}

// Run the investigation
main().catch(console.error);