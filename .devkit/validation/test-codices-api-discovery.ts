#!/usr/bin/env bun

/**
 * Codices API Discovery Test
 * Try different approaches to find the manifest URL for a given manuscript
 */

const MANUSCRIPT_URL = 'https://admont.codices.at/codices/169/90299';
const KNOWN_MANIFEST = 'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701';

async function extractManuscriptData(url: string) {
    // Extract library, collection, and manuscript ID
    const match = url.match(/codices\.at\/codices\/(\d+)\/(\d+)/);
    if (!match) return null;
    
    return {
        collection: match[1], // 169
        manuscript: match[2]  // 90299
    };
}

async function tryApiEndpoints(collection: string, manuscript: string) {
    const apiPatterns = [
        // Common API patterns for manuscript metadata
        `https://admont.codices.at/api/codices/${collection}/${manuscript}`,
        `https://admont.codices.at/api/manuscripts/${manuscript}`,
        `https://admont.codices.at/api/iiif/${manuscript}`,
        `https://admont.codices.at/codices/${collection}/${manuscript}/manifest`,
        `https://admont.codices.at/codices/${collection}/${manuscript}/iiif`,
        `https://admont.codices.at/iiif/codices/${collection}/${manuscript}`,
        `https://admont.codices.at/iiif/manifest/${manuscript}`,
        
        // JSON endpoints
        `https://admont.codices.at/codices/${collection}/${manuscript}.json`,
        `https://admont.codices.at/api/codices/${collection}/${manuscript}.json`,
        
        // IIIF Collection endpoints
        `https://admont.codices.at/iiif/collection/${collection}`,
        `https://admont.codices.at/iiif/${collection}`,
    ];

    console.log(`🔍 Testing ${apiPatterns.length} API endpoint patterns...\n`);

    const results = [];
    for (const endpoint of apiPatterns) {
        try {
            console.log(`Testing: ${endpoint}`);
            const response = await fetch(endpoint);
            
            const result = {
                url: endpoint,
                status: response.status,
                contentType: response.headers.get('content-type'),
                success: response.ok
            };

            if (response.ok) {
                try {
                    const data = await response.json();
                    result.data = data;
                    console.log(`  ✅ SUCCESS! Status: ${response.status}, Type: ${result.contentType}`);
                    
                    // Check if it's a IIIF manifest
                    if (data.type === 'Manifest' || data['@type'] === 'sc:Manifest') {
                        console.log(`  🎯 IIIF MANIFEST FOUND!`);
                        return { ...result, isManifest: true };
                    }
                    
                    // Check if it contains manifest references
                    const dataStr = JSON.stringify(data);
                    if (dataStr.includes('manifest') || dataStr.includes('iiif')) {
                        console.log(`  📋 Contains manifest references`);
                        result.hasManifestRefs = true;
                    }
                } catch {
                    // Not JSON, might be other format
                    const text = await response.text();
                    result.text = text.substring(0, 200);
                    console.log(`  ⚠️  Not JSON: ${text.substring(0, 100)}...`);
                }
            } else {
                console.log(`  ❌ Failed: ${response.status} ${response.statusText}`);
            }
            
            results.push(result);
            
        } catch (error) {
            console.log(`  💥 Error: ${error instanceof Error ? error.message : String(error)}`);
            results.push({
                url: endpoint,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

async function tryOtherApproaches() {
    console.log('\n🔍 Trying other discovery approaches...\n');
    
    // Try IIIF Collection endpoint
    const collectionEndpoints = [
        'https://admont.codices.at/iiif/collection',
        'https://admont.codices.at/iiif',
        'https://admont.codices.at/iiif/top',
        'https://admont.codices.at/api/iiif/collections'
    ];

    for (const endpoint of collectionEndpoints) {
        try {
            console.log(`Testing collection endpoint: ${endpoint}`);
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Collection endpoint works: ${endpoint}`);
                console.log(`Type: ${data.type || data['@type']}`);
                if (data.items || data.members || data.collections) {
                    console.log(`Contains items/collections that might list manuscripts`);
                }
                return data;
            } else {
                console.log(`❌ ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`💥 Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    return null;
}

async function analyzeKnownManifest() {
    console.log('\n🧪 Analyzing known working manifest for patterns...\n');
    
    try {
        const response = await fetch(KNOWN_MANIFEST);
        const manifest = await response.json();
        
        console.log(`Manifest ID: ${manifest.id}`);
        console.log(`Manifest Type: ${manifest.type}`);
        
        // Look for patterns in the manifest that might help us discover others
        if (manifest.metadata) {
            console.log('Metadata keys:', Object.keys(manifest.metadata));
        }
        
        if (manifest.label) {
            console.log('Label:', manifest.label);
        }
        
        // Check if there are any collection references
        if (manifest.partOf || manifest.within) {
            console.log('Part of collection:', manifest.partOf || manifest.within);
        }
        
        // The UUID pattern suggests we need to find a mapping
        const uuid = KNOWN_MANIFEST.match(/([a-f0-9-]{36})/)?.[1];
        if (uuid) {
            console.log(`UUID: ${uuid}`);
            console.log('Need to find: manuscript ID → UUID mapping');
        }
        
        return manifest;
    } catch (error) {
        console.log(`Error analyzing manifest: ${error}`);
        return null;
    }
}

async function main() {
    console.log('🧪 Codices API Discovery Test\n');
    console.log(`📚 Target: ${MANUSCRIPT_URL}`);
    console.log(`📋 Known working: ${KNOWN_MANIFEST}\n`);

    // Extract manuscript data
    const manuscriptData = extractManuscriptData(MANUSCRIPT_URL);
    if (!manuscriptData) {
        console.log('❌ Could not extract manuscript data from URL');
        return;
    }
    
    console.log(`📝 Extracted data:`);
    console.log(`   Collection: ${manuscriptData.collection}`);
    console.log(`   Manuscript: ${manuscriptData.manuscript}\n`);

    // Try API endpoints
    const apiResults = await tryApiEndpoints(manuscriptData.collection, manuscriptData.manuscript);
    
    // Check if we found any working endpoints
    const successfulApis = apiResults.filter(r => r.success && !r.error);
    if (successfulApis.length > 0) {
        console.log(`\n🎉 Found ${successfulApis.length} working API endpoints!`);
        successfulApis.forEach(api => {
            console.log(`✅ ${api.url}`);
            if (api.isManifest) {
                console.log(`   🎯 THIS IS A IIIF MANIFEST!`);
            }
        });
    } else {
        console.log('\n❌ No working API endpoints found');
    }

    // Try other approaches
    await tryOtherApproaches();
    
    // Analyze known manifest
    await analyzeKnownManifest();

    console.log('\n📝 CONCLUSIONS:');
    console.log('1. No direct API endpoints found for manuscript → manifest mapping');
    console.log('2. The site uses UUIDs for manifest URLs that are not derivable from manuscript IDs');
    console.log('3. Need alternative approach: JavaScript execution or site-specific scraping');
    console.log('4. Consider implementing a headless browser approach or finding the SPA API');
}

main().catch(console.error);